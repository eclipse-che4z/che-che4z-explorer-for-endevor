module.exports = {
  'no-quadratic-complexity': {
    meta: {
      fixable: 'code',
      docs: {
        description: 'ESLint local rule that will detect quadratic complexity',
        recommended: false,
      },
      schema: [],
    },
    create(context) {
      function process(node) {
        function searchTree(root, find) {
          const result = [];
          const targetCount = find.length;
          const pullType = () => {
            const nextType = find.shift();
            if (typeof nextType === 'string') return [nextType];
            else return nextType;
          };
          let nextType = pullType();
          let current = root;
          while (current && nextType) {
            if (nextType.indexOf(current.type) !== -1) {
              result.push(current);
              nextType = pullType();
            }
            current = current.parent;
          }
          return result.length === targetCount ? result : null;
        }
        const nodes = searchTree(node, [
          ['ObjectExpression', 'ArrayExpression', 'ReturnStatement'],
          ['FunctionExpression', 'ArrowFunctionExpression'],
          'CallExpression',
        ]);
        if (!nodes) return false;
        const [return_stmt, func_stmt, call_stmt] = nodes;
        if (func_stmt.params.length == 0) return false;

        if (func_stmt.params[0].name !== node.argument.name) return false;

        if (
          call_stmt.callee.type !== 'MemberExpression' ||
          call_stmt.callee.property.name !== 'reduce'
        )
          return false;
        if (
          call_stmt.arguments.length == 0 ||
          call_stmt.arguments[0] !== func_stmt
        )
          return false;

        return true;
      }
      return {
        SpreadElement(node) {
          const expand_into_stmt = node.parent;
          if (
            !expand_into_stmt ||
            !(
              expand_into_stmt.type === 'ArrayExpression' ||
              expand_into_stmt.type === 'ObjectExpression'
            )
          )
            return;
          if (process(node)) {
            const arg_name = node.argument.name;
            context.report({
              node,
              message: `Quadratic reduce algorithm detected for variable "${arg_name}"`,
            });
          }
        },
      };
    },
  },
};
