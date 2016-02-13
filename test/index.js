import expect from 'expect.js';
import {sql, ty, execSql} from '../';
import {TYPES} from 'tedious';

describe('sql fn', function() {
  it('lifts a template string into an AST', function() {
    const statement = sql`select a from b where d = ${1}`;

    expect(statement.sql).to.equal('select a from b where d = @$_0_0');
    expect(statement.parameters).to.be.an(Array);

    const [param1] = statement.parameters;    
    expect(param1.name).to.equal('$_0_0');
    expect(param1.val).to.equal(1);
  });

  it('handles zero parameters', function() {
    const statement = sql`select a from b where c = 1`;

    expect(statement.sql).to.equal('select a from b where c = 1');
  });
  
  it('handles multiple parameters', function() {
    const statement = sql`select a from b where d = ${1} and e = ${'f'}`;

    expect(statement.sql).to.equal('select a from b where d = @$_0_0 and e = @$_1_0');

    const [param1, param2] = statement.parameters;
    expect(param1.name).to.equal('$_0_0');
    expect(param1.val).to.equal(1);
    expect(param2.name).to.equal('$_1_0');
    expect(param2.val).to.equal('f');
  });

  it('expands array template values into multiple arguments', function() {
    const statement = sql`insert into a (b, c, d) values (${[1, 2, 3]})`;

    expect(statement.sql).to.equal('insert into a (b, c, d) values (@$_0_0, @$_0_1, @$_0_2)');

    const [param1, param2, param3] = statement.parameters;
    expect(param1.name).to.equal('$_0_0');
    expect(param1.val).to.equal(1);
    expect(param2.name).to.equal('$_0_1')
    expect(param2.val).to.equal(2);
    expect(param3.name).to.equal('$_0_2')
    expect(param3.val).to.equal(3);    
  });

  it('expands two-dimensional array template values into row value expression lists', function() {
    const statement = sql`insert into a (b, c) values ${[[1, 2], [3, 4]]}`;

    expect(statement.sql).to.equal('insert into a (b, c) values (@$_0_0, @$_0_1), (@$_0_2, @$_0_3)');
  });

  it('handles single and multiple arg cases in same statement', function() {
    const statement = sql`insert into a (b, c) values ${[[1, 2], [3, 4]]} where d = ${3}`;

    expect(statement.sql).to.equal('insert into a (b, c) values (@$_0_0, @$_0_1), (@$_0_2, @$_0_3) where d = @$_1_0');
  });
});

describe('ty fn', function() {
  it('returns an object for the value and type', function() {
    expect(ty(TYPES.Int, 1)).to.eql({type: TYPES.Int, val: 1});
  });

  it('annotates the statement parameters', function() {
    const statement = sql`insert into a (b, c) values (${[
      ty(TYPES.Int, 1),
      ty(TYPES.Text, 'foo')
    ]})`;
    
    const [type1, type2] = statement.parameters.map(({type}) => type);
    expect(type1).to.be(TYPES.Int);
    expect(type2).to.be(TYPES.Text);
  });
  
});

describe('execSql fn', function() {

  class mockConnection {
    constructor(provides=[]) {
      this.req = null;
      this.provides = provides;
    }

    execSql(req) {
      this.req = req;
      req.callback(null, this.provides.length, this.provides);
    }
  }
  
  it('returns a promise given a connection and statement', function(done) {
    const promise = execSql(new mockConnection, sql`select a from b`);

    expect(promise).to.be.a(Promise);
    promise.then(() => done());
  });

  it('adds parameters to the underlying Request', function(done) {
    const connection = new mockConnection;
    const statement = sql`select a from b where c = ${ty(TYPES.Bit, true)}`;
    const [param1] = statement.parameters;
    
    execSql(connection, statement)
      .then(() => {
        const [reqParam1] = connection.req.parameters;
        expect(reqParam1).to.be.ok();
        expect(reqParam1.name).to.be(param1.name);
        expect(reqParam1.value).to.be(param1.val);
        expect(reqParam1.type).to.eql(param1.type);

        done();
      });
  });

  it('supports ES7 async/await', async function(done) {
    const dummyResult = ['asdf'];
    
    try {
      const {rows} = await execSql(new mockConnection(dummyResult), sql`select a from b`);
      expect(rows).to.eql(dummyResult);

      done();
    } catch (err) {
      done(err);
    }
  }); 
});
