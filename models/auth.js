const db = require('../db/database');
const bcrypt = require('bcrypt');

// 사용자 로그인 검증
async function authenticateUser(email, password) {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM managers WHERE email = ?`;
    
    db.get(query, [email], async (err, user) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!user) {
        resolve({ authenticated: false, message: '사용자를 찾을 수 없습니다.' });
        return;
      }
      
      // 초기 비밀번호(1234)인 경우 평문 비교
      if (user.password === '1234') {
        if (password === '1234') {
          resolve({ authenticated: true, user, needsPasswordChange: true });
        } else {
          resolve({ authenticated: false, message: '비밀번호가 일치하지 않습니다.' });
        }
        return;
      }
      
      // 해시된 비밀번호 비교
      try {
        const match = await bcrypt.compare(password, user.password);
        if (match) {
          resolve({ authenticated: true, user });
        } else {
          resolve({ authenticated: false, message: '비밀번호가 일치하지 않습니다.' });
        }
      } catch (error) {
        reject(error);
      }
    });
  });
}

// 비밀번호 변경
async function changePassword(userId, newPassword) {
  return new Promise(async (resolve, reject) => {
    try {
      // 비밀번호 해싱
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      const query = `UPDATE managers SET password = ? WHERE id = ?`;
      
      db.run(query, [hashedPassword, userId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        if (this.changes === 0) {
          reject(new Error('사용자를 찾을 수 없습니다.'));
          return;
        }
        
        resolve({ success: true, message: '비밀번호가 변경되었습니다.' });
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 비밀번호 초기화 (1234로 설정)
async function resetPassword(userId) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE managers SET password = '1234' WHERE id = ?`;
    
    db.run(query, [userId], function(err) {
      if (err) {
        reject(err);
        return;
      }
      
      if (this.changes === 0) {
        reject(new Error('사용자를 찾을 수 없습니다.'));
        return;
      }
      
      resolve({ success: true, message: '비밀번호가 초기화되었습니다.' });
    });
  });
}

// 특정 이메일 사용자의 권한 설정
async function setUserRole(email, role) {
  return new Promise((resolve, reject) => {
    const query = `UPDATE managers SET role = ? WHERE email = ?`;
    
    db.run(query, [role, email], function(err) {
      if (err) {
        reject(err);
        return;
      }
      
      if (this.changes === 0) {
        reject(new Error('사용자를 찾을 수 없습니다.'));
        return;
      }
      
      resolve({ success: true, message: `사용자 권한이 '${role}'로 변경되었습니다.` });
    });
  });
}

// 어드민 계정 초기화 (박종철 - rionaid@com2us.com)
async function initializeAdminUser() {
  try {
    const adminEmail = 'rionaid@com2us.com';
    await setUserRole(adminEmail, '어드민');
    console.log('어드민 계정이 초기화되었습니다.');
    return { success: true };
  } catch (error) {
    console.error('어드민 계정 초기화 오류:', error);
    return { success: false, error };
  }
}

module.exports = {
  authenticateUser,
  changePassword,
  resetPassword,
  setUserRole,
  initializeAdminUser
}; 