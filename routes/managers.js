const express = require('express');
const router = express.Router();
const managerModel = require('../models/manager');
const gameModel = require('../models/game');
const accessLogModel = require('../models/accessLog');

// 담당자 목록 페이지
router.get('/', async (req, res) => {
  try {
    // 담당자 정보와 게임사 매핑 정보 가져오기
    const managers = await managerModel.getAllManagers();
    const mappings = await managerModel.getAllCompanyManagerMappings();
    
    // 모든 게임사 목록 가져오기
    const companies = await gameModel.getAllCompanies();
    
    res.render('managers/index', {
      title: '게임사 담당자 관리',
      managers,
      mappings,
      companies,
      query: req.query,
      userRole: req.session.user ? req.session.user.role : null
    });
  } catch (error) {
    console.error('담당자 목록 조회 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '담당자 정보를 불러오는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 담당자 추가 처리
router.post('/add', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // 유효성 검사
    if (!name || !email) {
      return res.status(400).render('error', {
        title: '입력 오류',
        message: '이름과 이메일은 필수 입력 항목입니다.',
        error: {}
      });
    }
    
    // 새 담당자 추가
    const newManager = await managerModel.addManager({ name, email });
    
    res.redirect('/managers?added=true');
  } catch (error) {
    console.error('담당자 추가 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '담당자를 추가하는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 회사-담당자 매핑 추가 처리
router.post('/mapping', async (req, res) => {
  try {
    const { company_name, manager_id } = req.body;
    
    // 유효성 검사
    if (!company_name || !manager_id) {
      return res.status(400).render('error', {
        title: '입력 오류',
        message: '회사와 담당자는 필수 입력 항목입니다.',
        error: {}
      });
    }
    
    // 회사-담당자 매핑 추가
    await managerModel.mapCompanyToManager(company_name, manager_id);
    
    res.redirect('/managers?mapped=true');
  } catch (error) {
    console.error('회사-담당자 매핑 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '회사와 담당자를 매핑하는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 회사-담당자 매핑 삭제
router.post('/mapping/delete', async (req, res) => {
  try {
    const { company_name, manager_id } = req.body;
    
    // 유효성 검사
    if (!company_name || !manager_id) {
      return res.status(400).render('error', {
        title: '입력 오류',
        message: '회사와 담당자 정보가 필요합니다.',
        error: {}
      });
    }
    
    // 회사-담당자 매핑 삭제
    await managerModel.deleteCompanyManagerMapping(company_name, manager_id);
    
    res.redirect('/managers?deleted_mapping=true');
  } catch (error) {
    console.error('회사-담당자 매핑 삭제 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '회사와 담당자 매핑을 삭제하는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 담당자 정보 가져오기 (AJAX)
router.get('/api/:id', async (req, res) => {
  try {
    const managerId = req.params.id;
    
    // 담당자가 담당하는 회사 목록 가져오기
    const companies = await managerModel.getCompaniesByManager(managerId);
    
    res.json({ success: true, companies });
  } catch (error) {
    console.error('담당자 정보 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '담당자 정보를 조회하는 중 오류가 발생했습니다.' 
    });
  }
});

// 담당자 접속 기록 조회 API
router.get('/api/:id/access-logs', async (req, res) => {
  try {
    const managerId = req.params.id;
    
    // 현재 사용자가 어드민인지 확인
    const isAdmin = req.session.user && req.session.user.role === '어드민';
    const isSelf = req.session.user && req.session.user.id === managerId;
    
    // 어드민이 아니고 본인의 기록도 아니면 접근 거부
    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: '접근 권한이 없습니다.'
      });
    }
    
    // 접속 기록 조회
    const logs = await accessLogModel.getManagerAccessLogs(managerId, { limit: 20 });
    
    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('담당자 접속 기록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '접속 기록을 조회하는 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 담당자 초기화 (샘플 데이터)
router.post('/initialize', async (req, res) => {
  try {
    const sampleData = [
      {
        name: '홍길동',
        email: 'hong@example.com',
        companies: ['넥슨', '펄어비스']
      },
      {
        name: '김철수',
        email: 'kim@example.com',
        companies: ['넷마블', '엔씨소프트']
      },
      {
        name: '이영희',
        email: 'lee@example.com',
        companies: ['스마일게이트', '크래프톤']
      }
    ];
    
    const result = await managerModel.initializeManagerData(sampleData);
    
    res.redirect('/managers?initialized=true');
  } catch (error) {
    console.error('담당자 초기화 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '담당자 데이터를 초기화하는 중 오류가 발생했습니다.',
      error
    });
  }
});

// 담당자 권한 변경 처리
router.post('/role', async (req, res) => {
  try {
    const { manager_id, role } = req.body;
    
    // 현재 사용자가 어드민인지 확인
    if (req.session.user.role !== '어드민') {
      return res.status(403).render('error', {
        title: '권한 오류',
        message: '담당자 권한을 변경할 수 있는 권한이 없습니다.',
        error: { status: 403 }
      });
    }
    
    // 유효성 검사
    if (!manager_id || !role) {
      return res.status(400).render('error', {
        title: '입력 오류',
        message: '담당자 ID와 변경할 권한은 필수 입력 항목입니다.',
        error: {}
      });
    }
    
    // 지원하는 역할인지 확인
    const validRoles = ['담당자', '매니저', '어드민'];
    if (!validRoles.includes(role)) {
      return res.status(400).render('error', {
        title: '입력 오류',
        message: '지원하지 않는 역할입니다.',
        error: {}
      });
    }
    
    // 담당자 권한 변경
    await managerModel.updateManagerRole(manager_id, role);
    
    res.redirect('/managers?role_updated=true');
  } catch (error) {
    console.error('담당자 권한 변경 오류:', error);
    res.status(500).render('error', {
      title: '오류 발생',
      message: '담당자 권한을 변경하는 중 오류가 발생했습니다.',
      error
    });
  }
});

module.exports = router; 