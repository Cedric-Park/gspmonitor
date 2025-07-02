const TelegramBot = require('node-telegram-bot-api');
const os = require('os');
const axios = require('axios');
const dotenv = require('dotenv');

// 환경 변수 로드
dotenv.config();

// 텔레그램 봇 토큰과 채팅 ID 설정
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 서버 포트
const PORT = process.env.PORT || 3000;

// 텔레그램 봇 초기화
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

// 로컬 IP 주소 가져오기
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  let ipAddress = 'Unknown';
  
  // 모든 네트워크 인터페이스 확인
  for (const interfaceName in interfaces) {
    const networkInterface = interfaces[interfaceName];
    
    // IPv4 주소만 필터링
    for (const network of networkInterface) {
      // 내부 IP 주소만 선택 (로컬이 아닌)
      if (network.family === 'IPv4' && !network.internal) {
        ipAddress = network.address;
        return ipAddress;
      }
    }
  }
  
  return ipAddress;
}

// 공인 IP 주소 가져오기
async function getPublicIpAddress() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error('공인 IP 주소를 가져오는 중 오류 발생:', error);
    return 'Unknown';
  }
}

// 텔레그램으로 메시지 보내기
async function sendTelegramMessage(message) {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.log('텔레그램 봇 토큰 또는 채팅 ID가 설정되지 않았습니다.');
      console.log('메시지 내용:');
      console.log(message);
      return;
    }
    
    await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'HTML' });
    console.log('텔레그램 메시지 전송 완료');
  } catch (error) {
    console.error('텔레그램 메시지 전송 오류:', error);
  }
}

async function setupTelegramBot() {
  try {
    // 텔레그램 설정 확인
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.log('경고: 텔레그램 봇 토큰 또는 채팅 ID가 설정되지 않았습니다.');
      console.log('텔레그램 알림이 비활성화됩니다.');
      console.log('환경 변수 .env 파일에 TELEGRAM_BOT_TOKEN과 TELEGRAM_CHAT_ID를 설정하세요.');
      return;
    }
    
    // 로컬 및 공인 IP 주소 가져오기
    const localIp = getLocalIpAddress();
    const publicIp = await getPublicIpAddress();
    
    // 공인 IP로 웹훅 설정
    const publicUrl = `http://${publicIp}:${PORT}`;
    console.log(`공인 IP URL: ${publicUrl}`);
    
    // 텔레그램 웹훅 설정 (필요한 경우 활성화)
    // bot.telegram.setWebhook(`${publicUrl}/telegram-webhook`);
    
    // 현재 시간
    const now = new Date().toLocaleString('ko-KR');
    
    // 텔레그램으로 접속 정보 전송
    const message = `
<b>🔄 모니터링 서버가 시작되었습니다</b>
<b>시간:</b> ${now}

<b>🌐 접속 정보:</b>
<b>공인 IP:</b> http://${publicIp}:${PORT}
<b>로컬 IP:</b> http://${localIp}:${PORT}
`;
    
    await sendTelegramMessage(message);
  } catch (error) {
    console.error('텔레그램 봇 설정 오류:', error);
  }
}

setupTelegramBot(); 