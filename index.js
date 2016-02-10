import {TYPES, Request} from 'tedious';

const zip2 = (xs, ys) => xs.map((x, idx) => [x, ys[idx]]);
const coerceArray = (xs) => Array.isArray(xs) ? xs : [xs];
const butLast = (xs) => xs.slice(0, -1);
const last = (xs) => xs[xs.length - 1];
const mapcat = (mapf, xs) => xs.reduce((ys, x) =>
                                       ys.concat(mapf(x)), []);

function toParam(valObj, innerIdx, outerIdx) {
  const {type, val} = Object.hasOwnProperty.call(valObj || 0, 'type')
        ? valObj
        : {type: undefined, val: valObj};
  return {name: `$_${outerIdx}_${innerIdx}`, type, val};
}

export function ty(type, val) {
  return {type, val};
};

export function sql(strings, ...values) {
  const ast = zip2(butLast(strings), values)
        .map(([str, value], outerIdx) => {          
          const groups = coerceArray(value)
                .map((groupObj, groupIdx) => {
                  if (Array.isArray(groupObj)) {
                    return {
                      wrap: true,
                      params: groupObj
                        .map((valObj, idx) =>
                             toParam(valObj, idx + (groupIdx * (1 + groupIdx)), outerIdx))
                    };
                  }
                  
                  return {
                    wrap: false,
                    params: [toParam(groupObj, groupIdx, outerIdx)]
                  };
                });

          const parameters = mapcat(({params}) => params, groups);
          
          const expression = str + (groups
                                    .map(({params, wrap}) => {
                                      const names = params
                                            .map(({name}) => `@${name}`)
                                            .join(', ');

                                      return wrap ? `(${names})` : names
                                    })
                                    .join(', '));
          
          return {expression, parameters};
        })
        .concat({expression: last(strings), parameters: []});

  const sql = ast.map(({expression}) => expression)
        .join('');

  const parameters = mapcat(({parameters}) => parameters, ast);

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
