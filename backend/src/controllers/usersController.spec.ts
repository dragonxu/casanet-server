import * as chai from 'chai';
import { expect } from 'chai';
import chaiHttp = require('chai-http');
import app from '../App';
import { User } from '../models/interfaces';

chai.use(chaiHttp);
const agent = chai.request.agent(app);

describe('Users routing API', () => {

    describe('/GET users', () => {
        it('it should respond 20x as status code', (done) => {
            agent.get('/API/users')
                .end((err, res) => {
                    expect(res.statusType).eql(2);
                    done();
                });
        });
    });

    describe('/GET users/{userId}', () => {
        it('it should respond 20x as status code', (done) => {
            agent.get('/API/users/userId')
                .end((err, res) => {
                    expect(res.statusType).eql(2);
                    done();
                });
        });
    });

    describe('/POST users', () => {
        it('it should respond 20x as status code', (done) => {
            const user: User = {
                firstName: '',
                ignoreTfa: false,
                lastName: '',
                password: '',
                sessionTimeOutMS: 334343232,
            };
            agent.post('/API/users')
                .send(user)
                .end((err, res) => {
                    expect(res.statusType).eql(2);
                    done();
                });
        });
    });

    describe('/PUT users/{userId}', () => {
        it('it should respond 20x as status code', (done) => {
            const user: User = {
                firstName: '',
                ignoreTfa: false,
                lastName: '',
                password: '',
                sessionTimeOutMS: 334343232,
            };
            agent.put('/API/users/userId')
                .send(user)
                .end((err, res) => {
                    expect(res.statusType).eql(2);
                    done();
                });
        });
    });

    describe('/DELETE users/{userId}', () => {
        it('it should respond 20x as status code', (done) => {
            agent.del('/API/users/userId')
                .end((err, res) => {
                    expect(res.statusType).eql(2);
                    done();
                });
        });
    });
});