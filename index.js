import {TYPES, Request} from 'tedious';

const zip2 = (xs, ys) => xs.map((x, idx) => [x, ys[idx]]);
const coerceArray = (xs) => Array.isArray(xs) ? xs : [xs];
const butLast = (xs) => xs.slice(0, -1);
const last = (xs) => xs[xs.length - 1];

export function ty(type, val) {
  return {type, val};
};

export function sql(strings, ...values) {
  const ast = zip2(butLast(strings), values)
        .map(([str, valObjs], idx) => {
          const parameters = coerceArray(valObjs)
                .map((valObj, valIdx) => {
                  const {type, val} = Object.hasOwnProperty.call(valObj || 0, 'type')
                        ? valObj
                        : {type: undefined, val: valObj};
                  return {name: `v${idx}${valIdx}`, type, val};
                });
          
          const expression = str + (parameters
                                    .map(({name}) => `@${name}`)
                                    .join(', '));
          
          return {expression, parameters};
        })
        .concat({expression: last(strings), parameters: []});

  const sql = ast.map(({expression}) => expression)
        .join('');

  const parameters = ast.reduce((agg, {parameters}) =>
                                agg.concat(parameters), []);

  return {ast, sql, parameters};
};

export function execSql(connection, statement) {
  return new Promise((resolve, reject) => {
    const req = new Request(statement.sql, (err, results) => err
                            ? reject(err)
                            : resolve(results));

    statement.parameters.forEach(({name, type, val}) => {
      req.addParameter(name, type, val);
    });

    connection.execSql.call(connection, req);
  });
}
