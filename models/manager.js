const db = require('../db/database');
const authModel = require('./auth');

// 모든 담당자 정보 가져오기
function getAllManagers() {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM managers ORDER BY name`;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// 담당자 정보 추가
function addManager(manager) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO managers (name, email)
      VALUES (?, ?)
    `;
    
    db.run(
      query, 
      [manager.name, manager.email],
      function(err) {
        if (err) {
          // UNIQUE 제약 조건 위반 시 (이미 존재하는 이메일)
          if (err.code === 'SQLITE_CONSTRAINT') {
            // 이메일로 해당 담당자 정보 가져오기
            getManagerByEmail(manager.email)
              .then(existingManager => resolve(existingManager))
              .catch(getErr => reject(getErr));
            return;
          }
          reject(err);
          return;
        }
        resolve({ id: this.lastID, ...manager });
      }
    );
  });
}

// 이메일로 담당자 정보 가져오기
function getManagerByEmail(email) {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM managers WHERE email = ?`;
    
    db.get(query, [email], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        reject(new Error(`이메일 ${email}에 해당하는 담당자가 없습니다.`));
        return;
      }
      
      resolve(row);
    });
  });
}

// 게임사와 담당자 매핑
function mapCompanyToManager(companyName, managerId) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT OR REPLACE INTO company_managers (company_name, manager_id)
      VALUES (?, ?)
    `;
    
    db.run(
      query,
      [companyName, managerId],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ 
          id: this.lastID, 
          company_name: companyName, 
          manager_id: managerId 
        });
      }
    );
  });
}

// 게임사별 담당자 정보 가져오기
function getManagersByCompany(companyName) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT m.* 
      FROM managers m
      JOIN company_managers cm ON m.id = cm.manager_id
      WHERE cm.company_name = ?
    `;
    
    db.all(query, [companyName], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// 담당자가 담당하는 게임사 목록 가져오기
function getCompaniesByManager(managerId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT company_name 
      FROM company_managers
      WHERE manager_id = ?
    `;
    
    db.all(query, [managerId], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows.map(row => row.company_name));
    });
  });
}

// 게임사-담당자 매핑 초기화 (샘플 데이터)
async function initializeManagerData(managerData) {
  try {
    // 모든 담당자 추가
    const managers = [];
    for (const data of managerData) {
      const manager = await addManager({ 
        name: data.name, 
        email: data.email 
      });
      managers.push(manager);
    }
    
    // 회사-담당자 매핑 추가
    const mappings = [];
    for (const data of managerData) {
      if (data.companies && data.companies.length > 0) {
        const manager = await getManagerByEmail(data.email);
        
        for (const company of data.companies) {
          const mapping = await mapCompanyToManager(company, manager.id);
          mappings.push(mapping);
        }
      }
    }
    
    return { 
      success: true, 
      message: '담당자 데이터 초기화 완료', 
      managers, 
      mappings 
    };
  } catch (error) {
    console.error('담당자 데이터 초기화 오류:', error);
    throw error;
  }
}

// 회사별 담당자 이메일 가져오기 (알림 용도)
function getManagerEmailsByCompany(companyName) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT m.email 
      FROM managers m
      JOIN company_managers cm ON m.id = cm.manager_id
      WHERE cm.company_name = ?
    `;
    
    db.all(query, [companyName], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows.map(row => row.email));
    });
  });
}

// 모든 게임사와 담당자 매핑 정보 가져오기
function getAllCompanyManagerMappings() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT cm.company_name, m.name as manager_name, m.email
      FROM company_managers cm
      JOIN managers m ON cm.manager_id = m.id
      ORDER BY cm.company_name, m.name
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// 게임사-담당자 매핑 삭제
function deleteCompanyManagerMapping(companyName, managerId) {
  return new Promise((resolve, reject) => {
    const query = `
      DELETE FROM company_managers
      WHERE company_name = ? AND manager_id = ?
    `;
    
    db.run(
      query,
      [companyName, managerId],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ 
          company_name: companyName, 
          manager_id: managerId,
          deleted: this.changes > 0 
        });
      }
    );
  });
}

// 담당자 권한 변경
function updateManagerRole(managerId, role) {
  return new Promise((resolve, reject) => {
    // 먼저 해당 ID로 담당자 이메일 조회
    const query = `SELECT email FROM managers WHERE id = ?`;
    
    db.get(query, [managerId], async (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        reject(new Error('해당 ID의 담당자를 찾을 수 없습니다.'));
        return;
      }
      
      try {
        // 이메일을 사용하여 권한 설정
        const result = await authModel.setUserRole(row.email, role);
        resolve({
          success: true,
          message: `담당자 권한이 '${role}'로 변경되었습니다.`,
          managerId,
          role
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

module.exports = {
  getAllManagers,
  addManager,
  getManagerByEmail,
  mapCompanyToManager,
  getManagersByCompany,
  getCompaniesByManager,
  initializeManagerData,
  getManagerEmailsByCompany,
  getAllCompanyManagerMappings,
  deleteCompanyManagerMapping,
  updateManagerRole
}; 