const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const schedule = require('node-schedule');
const notificationModel = require('./models/notification');
const authModel = require('./models/auth');
const gameModel = require('./models/game');

// 환경 변수 설정
dotenv.config();

// 환경에 따라 다른 데이터베이스 모듈 사용
const isVercel = process.env.VERCEL === '1';
const db = isVercel ? require('./db/mongodb') : require('./db/database');

// Express 애플리케이션 생성
const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 정적 파일 제공 설정
// Vercel에서는 public 폴더가 자동으로 제공되지 않을 수 있으므로 명시적으로 설정
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// 세션 설정
app.use(session({
  secret: 'gamepoint-monitoring-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 3600000, // 1시간
    secure: isVercel // Vercel에서는 HTTPS를 사용하므로 secure 쿠키 사용
  }
}));

// Flash 메시지 설정
app.use(flash());

// 뷰 엔진 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// 글로벌 변수 설정
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// 인증 미들웨어
const ensureAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

// 권한 검사 미들웨어
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }
    
    if (roles.includes(req.session.user.role)) {
      return next();
    }
    
    res.status(403).render('error', {
      title: '접근 권한 없음',
      message: '해당 기능에 접근할 수 있는 권한이 없습니다.',
      error: { status: 403 }
    });
  };
};

// 라우트 설정
const indexRouter = require('./routes/index');
const gameRouter = require('./routes/games');
const notificationRouter = require('./routes/notifications');
const managerRouter = require('./routes/managers');
const authRouter = require('./routes/auth');
const pointRouter = require('./routes/points');

// Vercel 환경에서 디버깅을 위한 라우트
app.get('/debug', (req, res) => {
  res.json({
    env: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
    mongodb: process.env.MONGODB_URI ? '설정됨' : '설정되지 않음',
    session: req.session,
    cookies: req.cookies
  });
});

app.use('/auth', authRouter);
app.use('/', ensureAuthenticated, indexRouter);
app.use('/games', ensureAuthenticated, checkRole(['어드민', '매니저', '담당자']), gameRouter);
app.use('/notifications', ensureAuthenticated, checkRole(['어드민']), notificationRouter);
app.use('/managers', ensureAuthenticated, checkRole(['어드민']), managerRouter);
app.use('/points', ensureAuthenticated, checkRole(['어드민', '매니저']), pointRouter);

// 데이터 동기화 경로 보호
app.use('/sync', ensureAuthenticated, checkRole(['어드민']), indexRouter);

// 에러 핸들러
app.use((req, res, next) => {
  res.status(404).render('error', {
    title: '페이지를 찾을 수 없음',
    message: '요청하신 페이지를 찾을 수 없습니다.',
    error: { status: 404 }
  });
});

app.use((err, req, res, next) => {
  console.error('오류 발생:', err);
  
  // JSON 응답을 요청한 경우
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    return res.status(err.status || 500).json({
      error: {
        message: err.message,
        status: err.status || 500
      }
    });
  }
  
  // HTML 응답
  res.status(err.status || 500).render('error', {
    title: '오류 발생',
    message: err.message,
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 서버리스 환경에서는 스케줄링 작업을 건너뜁니다
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  // 30분마다 데이터 동기화 스케줄링
  function scheduleDataSync() {
    schedule.scheduleJob('*/30 * * * *', async () => {
      console.log('30분 주기 데이터 동기화 실행 중...');
      try {
        await gameModel.syncWithGoogleSheet();
        console.log('데이터 동기화 완료');
      } catch (error) {
        console.error('자동 데이터 동기화 오류:', error);
      }
    });
    console.log('데이터 동기화 스케줄이 설정되었습니다. (30분 간격)');
  }

  // 알림 스케줄링 설정
  notificationModel.scheduleNotificationChecks();

  // 데이터 동기화 스케줄링 설정
  scheduleDataSync();

  // 데이터베이스 초기화 완료 후 어드민 계정 설정
  db.setInitCallback(() => {
    console.log('데이터베이스 초기화가 완료되었습니다. 어드민 계정을 설정합니다.');
    
    // 어드민 계정 초기화
    authModel.initializeAdminUser()
      .then(() => {
        console.log('어드민 계정 설정 완료');
      })
      .catch(err => {
        console.error('어드민 계정 설정 오류:', err);
      });
  });
}

// 개발 환경에서만 서버를 시작합니다
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
  });
}

// Vercel 서버리스 환경을 위해 모듈 내보내기
module.exports = app; 