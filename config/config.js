// 환경 설정 파일

module.exports = {
  port: process.env.PORT || 3000,
  environment: process.env.NODE_ENV || 'development',
  
  // 구글 스프레드시트 설정
  googleSheet: {
    sheetId: '1rwYFY1VdwF5eRS0QKEa5NhJp_xQOtVfqCxaV0oeEI3A',
    range: 'GameInfo!A:F',
    contractSheetId: '1f-hZy_FJUS3ga6MV3KRqFy5vOEghNjVpH1poGRu7fDw', // 계약 정보 스프레드시트 ID
    contractRange: '게임더하기_계약_2025!A:N' // N열까지 확장 (K~N열: 협력사명, 계약금액, 업무시작일, 업무종료일)
  },
  
  // 데이터베이스 설정
  database: {
    filename: 'game_points.db'
  },

  // 이메일 알림 설정
  email: {
    service: 'gmail', // 이메일 서비스 (gmail, hotmail 등)
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    password: process.env.EMAIL_PASSWORD || 'your-app-password',
    sendFrom: process.env.EMAIL_SEND_FROM || 'Game Points Monitor <your-email@gmail.com>'
  },

  // 애플리케이션 기본 URL
  baseUrl: process.env.BASE_URL || 'http://localhost:3000'
}; 