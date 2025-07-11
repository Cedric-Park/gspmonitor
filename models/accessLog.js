const db = require('../db/database');

/**
 * 현재 한국 시간을 ISO 문자열로 반환
 * @returns {string} 한국 시간 ISO 문자열
 */
function getCurrentKoreanTime() {
  // 현재 시간 가져오기
  const now = new Date();
  
  // 현재 서버 시간을 그대로 사용 (서버가 이미 KST로 설정되어 있다고 가정)
  // ISO 문자열로 변환하여 반환
  return now.toISOString();
}

/**
 * 접속 로그 기록 (로그인)
 * @param {Object} logData 로그 데이터
 * @returns {Promise<Object>} 생성된 로그 정보
 */
function createLoginLog(logData) {
  return new Promise((resolve, reject) => {
    const koreanTime = getCurrentKoreanTime();
    
    const query = `
      INSERT INTO access_logs (
        manager_id, manager_name, manager_email, manager_role,
        action, ip_address, user_agent, login_status,
        login_time, session_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(
      query,
      [
        logData.manager_id,
        logData.manager_name,
        logData.manager_email,
        logData.manager_role,
        'login',
        logData.ip_address,
        logData.user_agent,
        logData.login_status,
        koreanTime,
        logData.session_id
      ],
      function(err) {
        if (err) {
          console.error('접속 로그 저장 오류:', err);
          reject(err);
          return;
        }
        
        resolve({
          id: this.lastID,
          ...logData,
          action: 'login',
          login_time: koreanTime
        });
      }
    );
  });
}

/**
 * 접속 로그 업데이트 (로그아웃)
 * @param {string} sessionId 세션 ID
 * @returns {Promise<Object>} 업데이트된 로그 정보
 */
function updateLogoutTime(sessionId) {
  return new Promise((resolve, reject) => {
    const koreanTime = getCurrentKoreanTime();
    
    const query = `
      UPDATE access_logs
      SET logout_time = ?,
          action = 'logout'
      WHERE session_id = ? AND logout_time IS NULL
    `;
    
    db.run(query, [koreanTime, sessionId], function(err) {
      if (err) {
        console.error('로그아웃 시간 업데이트 오류:', err);
        reject(err);
        return;
      }
      
      if (this.changes === 0) {
        // 매칭되는 로그가 없는 경우 (이미 로그아웃 처리되었거나 로그인 기록이 없는 경우)
        resolve({ updated: false, message: '매칭되는 로그인 기록이 없습니다.' });
        return;
      }
      
      resolve({ 
        updated: true, 
        message: '로그아웃 시간이 기록되었습니다.',
        session_id: sessionId,
        logout_time: koreanTime
      });
    });
  });
}

/**
 * 특정 담당자의 접속 로그 가져오기
 * @param {number} managerId 담당자 ID
 * @param {Object} options 필터링 옵션
 * @returns {Promise<Array>} 접속 로그 배열
 */
function getManagerAccessLogs(managerId, options = {}) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT * FROM access_logs
      WHERE manager_id = ?
    `;
    
    const params = [managerId];
    
    // 정렬 (기본: 최신순)
    query += ` ORDER BY login_time DESC`;
    
    // 페이지네이션
    if (options.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('접속 로그 조회 오류:', err);
        reject(err);
        return;
      }
      
      resolve(rows);
    });
  });
}

/**
 * 접속 로그 목록 가져오기 (필터링 지원)
 * @param {Object} filters 필터링 옵션
 * @returns {Promise<Array>} 접속 로그 배열
 */
function getAccessLogs(filters = {}) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT al.*, m.name as manager_name, m.email as manager_email
      FROM access_logs al
      LEFT JOIN managers m ON al.manager_id = m.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // 담당자 ID 필터
    if (filters.manager_id) {
      query += ` AND al.manager_id = ?`;
      params.push(filters.manager_id);
    }
    
    // 액션 필터
    if (filters.action) {
      query += ` AND al.action = ?`;
      params.push(filters.action);
    }
    
    // 시작일 필터
    if (filters.start_date) {
      query += ` AND DATE(al.login_time) >= DATE(?)`;
      params.push(filters.start_date);
    }
    
    // 종료일 필터
    if (filters.end_date) {
      query += ` AND DATE(al.login_time) <= DATE(?)`;
      params.push(filters.end_date);
    }
    
    // 정렬 (기본: 최신순)
    query += ` ORDER BY al.login_time DESC`;
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('접속 로그 조회 오류:', err);
        reject(err);
        return;
      }
      
      resolve(rows || []);
    });
  });
}

module.exports = {
  createLoginLog,
  updateLogoutTime,
  getManagerAccessLogs,
  getAccessLogs
};