// ********************** Initialize server **********************************

const server = require('../index'); //TODO: Make sure the path to your index.js is correctly added

// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        //expect(res.body.status).to.equals('success');
        //assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

// *********************** TODO: WRITE 2 UNIT TESTCASES **************************
describe('Testing Add User API', () => {
  it('positive : /register', done => {
    chai
      .request(server)
      .post('/register')
      .send({username: 'test_name', password: 'test_password'})
      .end((err, res) => {
        res.should.have.status(200); // Expecting a success status code
        res.should.be.html; // Expecting a HTML response
        done();
      });
  });
  it('Negative : /register. Checking invalid name', done => {
    chai
      .request(server)
      .post('/register')
      .send({username: 'test_name', password: 'test_password'})
      .end((err, res) => {
        res.should.have.status(400); // Expecting a success status code
        res.should.be.html; // Expecting a HTML response
        done();
      });
  });
});

describe('Testing logout render', () => {
  // Sample test case given to test /test endpoint.
  it('test "/logout" route should render with an html response', done => {
    chai
      .request(server)
      .get('/logout') // for reference, see lab 8's login route (/login) which renders home.hbs
      .end((err, res) => {
        res.should.have.status(200); // Expecting a success status code
        res.should.be.html; // Expecting a HTML response
        done();
      });
  });
});

describe('Testing login requests', () => {
  // Sample test case given to test /test endpoint.
  it('Positive: "/login" route should render with an html response', done => {
    chai
      .request(server)
      .post('/login') // for reference, see lab 8's login route (/login) which renders home.hbs
      .send({username: 'test_name', password: 'test_password'})
      .end((err, res) => {
        res.should.have.status(200); // Expecting a success status code
        res.should.be.html; // Expecting a HTML response
        done();
      });
  });
  it('Negative: "/login" should respond with an error and reroute back to /login', done => {
    chai
      .request(server)
      .post('/login') // for reference, see lab 8's login route (/login) which renders home.hbs
      .send({username: 'nonexistent_name', password: 'nonexistent_password'})
      .end((err, res) => {
        res.should.have.status(400); // Expecting a success status code
        res.should.be.html; // Expecting a HTML response
        done();
      });
  });
});


// ********************************************************************************