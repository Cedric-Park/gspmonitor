const express = require('express');
const router = express.Router();
const authModel = require('../models/auth');

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
    
    // 입력값 확인
    if (!email || !password) {
      req.flash('error', '이메일과 비밀번호를 모두 입력해주세요.');
      return res.redirect('/auth/login');
    }
    
    // 사용자 인증
    const result = await authModel.authenticateUser(email, password);
    
    if (!result.authenticated) {
      req.flash('error', result.message);
      return res.redirect('/auth/login');
    }
    
    // 세션에 사용자 정보 저장
    req.session.user = {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role
    };
    
    // 초기 비밀번호 사용 중인 경우 비밀번호 변경 페이지로 리디렉션
    if (result.needsPasswordChange) {
      req.flash('info', '초기 비밀번호를 사용 중입니다. 보안을 위해 비밀번호를 변경해주세요.');
      return res.redirect('/auth/change-password');
    }
    
    res.redirect('/');
  } catch (error) {
    console.error('로그인 처리 오류:', error);
    req.flash('error', '로그인 처리 중 오류가 발생했습니다.');
    res.redirect('/auth/login');
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

module.exports = router; 