const https = require('https');
const fs = require('fs');

// 1. 인증서 로드 (경로 확인 필수)
const options = {
  key: fs.readFileSync('/home/candidate/imagechecker/key.pem'),
  cert: fs.readFileSync('/home/candidate/imagechecker/cert.pem')
};

// 2. 서버 생성
const server = https.createServer(options, (req, res) => {
  let body = '';

  // 데이터를 모읍니다.
  req.on('data', chunk => { body += chunk; });

  // 데이터 수신이 끝나면 무조건 이 블록 딱 하나만 실행됩니다.
  req.on('end', () => {

    // 검증 로직: body에 'nginx'나 'latest' 문자열이 들어있으면 거부(allowed: false)
    let allowed = true;
    let reason = "Image is valid.";

    if (body.includes('nginx') || body.includes('latest')) {
      allowed = false;
      reason = "Rejected: Contains nginx or latest tag!";
    }

    // 쿠버네티스 규격에 맞게 응답 구성
    const responseData = {
      apiVersion: "imagepolicy.k8s.io/v1alpha1",
      kind: "ImageReview",
      status: { allowed: allowed, reason: reason }
    };

    // 응답 전송 (딱 한 번만 보냅니다)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseData));

    // Nginx 파일 로그 기록 (무조건 한 줄 기록)
    const logLine = `127.0.0.1 - - [${new Date().toUTCString()}] "${req.method} ${req.url} HTTP/1.1" 200 - Allowed:${allowed}\n`;
    fs.appendFileSync('/var/log/nginx/access_log', logLine, 'utf8');

    console.log(`[OK] Request processed. Allowed: ${allowed}`);
  });
});

// 3. 443 포트로 서버 대기
server.listen(443, '0.0.0.0', () => {
  console.log('Webhook Server is running on https://smooth-yak.local:443/review');
});