const bcrypt = require('bcrypt');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

// 환경 변수 설정
dotenv.config();

// MongoDB 연결 문자열
const uri = process.env.MONGODB_URI || 'mongodb+srv://rionaid81:roU7EBn1uTVy7Z0G@cluster01.kjpr3ku.mongodb.net/game_points?retryWrites=true&w=majority&appName=Cluster01';

// MongoDB 연결 함수
async function connectToDatabase() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('game_points');
  return { client, db };
}

// 사용자 로그인 검증
async function authenticateUser(email, password) {
  let client;
  try {
    console.log('MongoDB 인증 시작:', email);
    const { client: dbClient, db } = await connectToDatabase();
    client = dbClient;
    console.log('MongoDB 연결 성공');
    
    const managersCollection = db.collection('managers');
    console.log('managers 컬렉션 접근');
    
    // 사용자 조회 - 이메일로 찾기
    const user = await managersCollection.findOne({ email });
    
    if (!user) {
      console.log('사용자를 찾을 수 없음:', email);
      return { authenticated: false, message: '사용자를 찾을 수 없습니다.' };
    }
    
    console.log('MongoDB에서 사용자 찾음:', email);
    
    // 비밀번호 검증 - 초기 비밀번호(1234) 처리
    if (password === '1234' && user.password === '1234') {
      console.log('초기 비밀번호 인증 성공');
      return { 
        authenticated: true, 
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }, 
        needsPasswordChange: true 
      };
    }
    
    // 비밀번호 검증 - 평문 비밀번호
    if (user.password === password) {
      console.log('평문 비밀번호 인증 성공');
      return { 
        authenticated: true, 
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }, 
        needsPasswordChange: true 
      };
    }
    
    // 비밀번호 불일치
    console.log('비밀번호 불일치');
    return { authenticated: false, message: '비밀번호가 일치하지 않습니다.' };
    
  } catch (error) {
    console.error('MongoDB 인증 오류:', error);
    throw error;
  } finally {
    if (client) {
      try {
        await client.close();
        console.log('MongoDB 연결 종료');
      } catch (closeError) {
        console.error('MongoDB 연결 종료 오류:', closeError);
      }
    }
  }
}

// 비밀번호 변경
async function changePassword(userId, newPassword) {
  let client;
  try {
    const { client: dbClient, db } = await connectToDatabase();
    client = dbClient;
    
    const managersCollection = db.collection('managers');
    
    // 비밀번호 해싱
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    const result = await managersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: hashedPassword, updated_at: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    return { success: true, message: '비밀번호가 변경되었습니다.' };
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    throw error;
  } finally {
    if (client) await client.close();
  }
}

// 특정 이메일 사용자의 권한 설정
async function setUserRole(email, role) {
  let client;
  try {
    const { client: dbClient, db } = await connectToDatabase();
    client = dbClient;
    
    const managersCollection = db.collection('managers');
    
    const result = await managersCollection.updateOne(
      { email },
      { $set: { role, updated_at: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    return { success: true, message: `사용자 권한이 '${role}'로 변경되었습니다.` };
  } catch (error) {
    console.error('권한 설정 오류:', error);
    throw error;
  } finally {
    if (client) await client.close();
  }
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
  setUserRole,
  initializeAdminUser
}; 