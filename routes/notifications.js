const express = require('express');
const router = express.Router();
const notificationModel = require('../models/notification');
const gameModel = require('../models/game');

// 알림 설정 목록 페이지
router.get('/', async (req, res) => {
  try {
    const settings = await notificationModel.getAllNotificationSettings();
    const history = await notificationModel.getNotificationHistory();
    
    res.render('notifications/index', {
      title: '알림 설정',
      settings,
      history
    });
  } catch (error) {
    console.error('알림 설정 목록 조회 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '알림 설정을 불러오는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 알림 설정 추가 페이지
router.get('/add', async (req, res) => {
  try {
    // 모든 게임과 회사 정보 가져오기
    const games = await gameModel.getAllGames();
    const companies = [...new Set(games.map(game => game.company_name))].sort();
    
    res.render('notifications/add', {
      title: '알림 설정 추가',
      companies,
      games
    });
  } catch (error) {
    console.error('알림 설정 추가 페이지 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '알림 설정 추가 페이지를 불러오는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 알림 설정 추가 처리
router.post('/add', async (req, res) => {
  try {
    const { company_name, game_name, email, threshold } = req.body;
    
    // 유효성 검사
    if (!email) {
      return res.status(400).render('error', {
        title: '입력 오류',
        message: '이메일은 필수 입력 항목입니다.',
        error: {}
      });
    }
    
    // 새 알림 설정 추가
    const newSetting = {
      company_name: company_name || null,
      game_name: game_name || null,
      email,
      threshold: parseInt(threshold) || 0,
      is_active: true
    };
    
    await notificationModel.addNotificationSetting(newSetting);
    
    res.redirect('/notifications?added=true');
  } catch (error) {
    console.error('알림 설정 추가 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '알림 설정을 추가하는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 알림 설정 수정 페이지
router.get('/edit/:id', async (req, res) => {
  try {
    const settingId = req.params.id;
    
    // 알림 설정 정보 가져오기
    const settings = await notificationModel.getAllNotificationSettings();
    const setting = settings.find(s => s.id === parseInt(settingId));
    
    if (!setting) {
      return res.status(404).render('error', {
        title: '설정을 찾을 수 없음',
        message: '요청하신 알림 설정을 찾을 수 없습니다.',
        error: {}
      });
    }
    
    // 모든 게임과 회사 정보 가져오기
    const games = await gameModel.getAllGames();
    const companies = [...new Set(games.map(game => game.company_name))].sort();
    
    res.render('notifications/edit', {
      title: '알림 설정 수정',
      setting,
      companies,
      games
    });
  } catch (error) {
    console.error('알림 설정 수정 페이지 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '알림 설정 수정 페이지를 불러오는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 알림 설정 수정 처리
router.post('/edit/:id', async (req, res) => {
  try {
    const settingId = req.params.id;
    const { company_name, game_name, email, threshold, is_active } = req.body;
    
    // 유효성 검사
    if (!email) {
      return res.status(400).render('error', {
        title: '입력 오류',
        message: '이메일은 필수 입력 항목입니다.',
        error: {}
      });
    }
    
    // 알림 설정 업데이트
    const updatedSetting = {
      company_name: company_name || null,
      game_name: game_name || null,
      email,
      threshold: parseInt(threshold) || 0,
      is_active: is_active === 'on' || is_active === true
    };
    
    await notificationModel.updateNotificationSetting(settingId, updatedSetting);
    
    res.redirect('/notifications?updated=true');
  } catch (error) {
    console.error('알림 설정 수정 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '알림 설정을 수정하는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 알림 설정 삭제
router.get('/delete/:id', async (req, res) => {
  try {
    const settingId = req.params.id;
    
    // 알림 설정 삭제
    await notificationModel.deleteNotificationSetting(settingId);
    
    res.redirect('/notifications?deleted=true');
  } catch (error) {
    console.error('알림 설정 삭제 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '알림 설정을 삭제하는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 수동 알림 체크 실행
router.get('/check', async (req, res) => {
  try {
    // 알림 체크 실행
    const result = await notificationModel.checkThresholdNotifications();
    
    res.redirect('/notifications?checked=true');
  } catch (error) {
    console.error('수동 알림 체크 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '알림을 확인하는 중 오류가 발생했습니다.',
      error
    });
  }
});

module.exports = router; 