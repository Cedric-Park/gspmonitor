// localtunnel 설정 파일
const localtunnel = require('localtunnel');

async function startTunnel() {
  const tunnel = await localtunnel({ 
    port: 3000,
    subdomain: 'monitoring-app',
    // 패스워드 설정 (원하는 패스워드로 변경)
    auth: 'username:password' 
  });

  console.log(`터널이 생성되었습니다: ${tunnel.url}`);
  console.log(`패스워드가 설정된 직접 접속 URL: ${tunnel.url}?auth=username:password`);

  tunnel.on('close', () => {
    console.log('터널이 닫혔습니다');
  });

  // 에러 처리
  tunnel.on('error', (err) => {
    console.error('터널 에러:', err);
  });
}

startTunnel(); 