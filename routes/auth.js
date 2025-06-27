const express = require('express');
const router = express.Router();
const dotenv = require('dotenv');

// 환경 변수 설정
dotenv.config();

// 환경에 따라 다른 인증 모델 사용
const isVercel = process.env.VERCEL === '1';
const authModel = isVercel ? require('../models/mongoAuth') : require('../models/auth');

// 로그인 페이지
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/login', {
    title: '로그인',
    error: req.flash('error')
  });
});

// 로그인 처리
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('로그인 시도:', email);
    
    // 입력값 확인
    if (!email || !password) {
      console.log('이메일 또는 비밀번호 누락');
      req.flash('error', '이메일과 비밀번호를 모두 입력해주세요.');
      return res.redirect('/auth/login');
    }
    
    // 사용자 인증
    console.log('인증 모듈 호출 전');
    let result;
    try {
      result = await authModel.authenticateUser(email, password);
      console.log('인증 모듈 호출 완료');
    } catch (authError) {
      console.error('인증 모듈 오류:', authError);
      req.flash('error', '인증 과정에서 오류가 발생했습니다.');
      return res.redirect('/auth/login');
    }
    
    console.log('인증 결과:', result.authenticated ? '성공' : '실패', result.message || '');
    
    if (!result.authenticated) {
      req.flash('error', result.message);
      return res.redirect('/auth/login');
    }
    
    // 세션에 사용자 정보 저장
    try {
      console.log('세션에 사용자 정보 저장 시도');
      const userId = result.user.id || (result.user._id ? result.user._id.toString() : null);
      
      if (!userId) {
        console.error('사용자 ID가 없음:', result.user);
        req.flash('error', '사용자 ID를 찾을 수 없습니다.');
        return res.redirect('/auth/login');
      }
      
      // 세션에 최소한의 필요한 정보만 저장
      req.session.user = {
        id: userId,
        name: result.user.name || '사용자',
        email: result.user.email,
        role: result.user.role || '사용자'
      };
      
      // 초기 비밀번호 사용 중인 경우 비밀번호 변경 페이지로 리디렉션
      if (result.needsPasswordChange) {
        console.log('초기 비밀번호 사용 중, 비밀번호 변경 페이지로 리디렉션');
        req.flash('info', '초기 비밀번호를 사용 중입니다. 보안을 위해 비밀번호를 변경해주세요.');
        return res.redirect('/auth/change-password');
      }
      
      console.log('로그인 성공, 메인 페이지로 리디렉션');
      return res.redirect('/');
      
    } catch (sessionError) {
      console.error('세션 처리 오류:', sessionError);
      req.flash('error', '세션 처리 중 오류가 발생했습니다.');
      return res.redirect('/auth/login');
    }
  } catch (error) {
    console.error('로그인 처리 오류:', error);
    req.flash('error', '로그인 처리 중 오류가 발생했습니다.');
    return res.redirect('/auth/login');
  }
});

// 비밀번호 변경 페이지
router.get('/change-password', (req, res) => {
  // 로그인 상태 확인
  if (!req.session.user) {
    req.flash('error', '로그인이 필요합니다.');
    return res.redirect('/auth/login');
  }
  
  res.render('auth/change-password', {
    title: '비밀번호 변경',
    error: req.flash('error'),
    info: req.flash('info')
  });
});

// 비밀번호 변경 처리
router.post('/change-password', async (req, res) => {
  try {
    // 로그인 상태 확인
    if (!req.session.user) {
      req.flash('error', '로그인이 필요합니다.');
      return res.redirect('/auth/login');
    }
    
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // 입력값 확인
    if (!currentPassword || !newPassword || !confirmPassword) {
      req.flash('error', '모든 필드를 입력해주세요.');
      return res.redirect('/auth/change-password');
    }
    
    // 새 비밀번호 확인
    if (newPassword !== confirmPassword) {
      req.flash('error', '새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return res.redirect('/auth/change-password');
    }
    
    // 현재 비밀번호 확인
    const authResult = await authModel.authenticateUser(req.session.user.email, currentPassword);
    if (!authResult.authenticated) {
      req.flash('error', '현재 비밀번호가 일치하지 않습니다.');
      return res.redirect('/auth/change-password');
    }
    
    // 비밀번호 변경
    await authModel.changePassword(req.session.user.id, newPassword);
    
    req.flash('success', '비밀번호가 성공적으로 변경되었습니다.');
    res.redirect('/');
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    req.flash('error', '비밀번호 변경 중 오류가 발생했습니다.');
    res.redirect('/auth/change-password');
  }
});

// 로그아웃
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('세션 삭제 오류:', err);
    }
    res.redirect('/auth/login');
  });
});

// 디버그 경로 - 세션 정보 확인
router.get('/debug-session', (req, res) => {
  res.json({
    sessionExists: !!req.session,
    user: req.session.user || null,
    sessionID: req.sessionID
  });
});

module.exports = router; 