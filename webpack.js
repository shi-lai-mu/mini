const fs = require("fs");
const path = require("path");
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");

class Webpack {
  constructor(file) {
    const bundleContent = this.parseModules(file)
    this.generateBundle(bundleContent, file)
  }

  parseModuleFile(file) {
    const exit = path.extname(file)
    const content = fs.readFileSync(`${file}${exit ? '' : '.js'}`, 'utf-8')
    const deps = {}
 
    // 转为AST语法树
    const ast = parse(content, {
      // 解析目标为module es模块
      sourceType: 'module'
    })

    // 收集依赖
    traverse(ast, {
      ImportDeclaration({ node }) {
        deps[node.source.value] = `./${path.dirname(file)}/${node.source.value}`
      }
    })

    // ES6转ES5
    const { code } = babel.transformFromAst(ast, null, {
      presets: ['@babel/preset-env']
    })

    return {
      file,
      deps,
      code,
    }
  }


  parseModules(file) {
    const entry = this.parseModuleFile(file)
    const temp = [ entry ]
    const depsGraph = {}

    this.getDeps(temp, entry)

    temp.forEach(moduleItem => {
      const { file, code, deps } = moduleItem
      depsGraph[file] = { deps, code  }
    })

    return depsGraph
  }


  getDeps(temp, { deps }) {
    Object.values(deps).forEach(depsPath => {
      const childDeps = this.parseModuleFile(depsPath)
      temp.push(childDeps)
      this.getDeps(temp, childDeps)
    })
  }


  generateBundle(content, file) {
    const depsGraph = JSON.stringify(content)
      .replace(/\\n/g, '')
      .replace(/\\"/g, "'")
    
    if (!fs.existsSync('./dist')) {
      fs.mkdirSync('./dist')
    }

    fs.writeFileSync(path.join('dist', 'bundle.js'), `
      (function (graph) {
        function require(file) {
          var exports = {};
          function absRequire(relPath) {
            return require(graph[file].deps[relPath])
          }
          (function (require, exports, code) {
            eval(code);
          })(
            absRequire,
            exports,
            graph[file].code,
          );
          return exports;
        }
        require('${file}')
      })(${depsGraph})
    `.replace(/\s{2}/g, ''))
  }
}

new Webpack('./src/index.js')