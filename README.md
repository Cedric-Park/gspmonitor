# 게임사 포인트 모니터링 시스템

게임사별 포인트 사용 현황을 모니터링하는 웹 애플리케이션입니다.

## 기능

- 게임사별 포인트 사용 현황 조회
- 서비스 부문별 포인트 사용 통계
- 포인트 사용률 차트 시각화
- 관리자/매니저/담당자 권한 관리
- 알림 설정 및 관리

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 모드로 실행
npm run dev

# 프로덕션 모드로 실행
npm start
```

## 텔레그램 봇 설정 및 IP 알림 기능

서버가 시작될 때 현재 접속 가능한 IP 주소를 텔레그램으로 알려주는 기능을 사용하려면 다음 단계를 따르세요:

1. 텔레그램에서 [@BotFather](https://t.me/BotFather)를 검색하여 새 봇 생성
2. `/newbot` 명령어로 봇 생성 후 토큰 받기
3. 생성된 봇과 대화를 시작하고, [@userinfobot](https://t.me/userinfobot)을 통해 자신의 채팅 ID 확인
4. 프로젝트 루트에 `.env` 파일 생성 후 다음 내용 추가:

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
LT_SUBDOMAIN=monitoring-app
LT_AUTH_USERNAME=username
LT_AUTH_PASSWORD=password
PORT=3000
```

5. 텔레그램 알림과 함께 서버 실행:

```bash
npm run start:telegram
```

이제 서버가 시작될 때마다 로컬 IP, 공인 IP, 터널 URL이 텔레그램으로 전송됩니다.

## 환경 설정

`.env` 파일을 프로젝트 루트에 생성하고 필요한 환경 변수를 설정하세요.

## 라이선스

MIT

## 프로젝트 구조

- `/routes`: API 라우트 정의
- `/models`: 데이터베이스 모델
- `/views`: 프론트엔드 뷰
- `/public`: 정적 파일
- `/config`: 구성 파일
- `/db`: 데이터베이스 관련 파일 