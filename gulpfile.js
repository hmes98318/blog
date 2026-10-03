const gulp = require('gulp')
const cleanCSS = require('gulp-clean-css')
const htmlmin = require('gulp-html-minifier-terser')
const terser = require('gulp-terser')

// minify js
function compressJavaScript () {
  return gulp.src(['public/**/*.js', '!public/**/*.min.js'])
    .pipe(terser())
    .pipe(gulp.dest('public'))
}

// css
function compressCSS () {
  return gulp.src('public/**/*.css')
    .pipe(cleanCSS())
    .pipe(gulp.dest('public'))
}

// 壓縮 public 目錄內 html
function compressHTML () {
  return gulp.src('public/**/*.html')
    .pipe(htmlmin({
      removeComments: true, // 清除 HTML 註釋
      collapseWhitespace: true, // 壓縮 HTML
      collapseBooleanAttributes: true, // 省略布爾屬性的值 <input checked="true"/> ==> <input />
      removeEmptyAttributes: true, // 刪除所有空格作屬性值 <input id="" /> ==> <input />
      removeScriptTypeAttributes: true, // 刪除 <script> 的 type="text/javascript"
      removeStyleLinkTypeAttributes: true, // 刪除 <style> 和 <link> 的 type="text/css"
      minifyJS: true, // 壓縮頁面 JS
      minifyCSS: true, // 壓縮頁面 CSS
      minifyURLs: true
    }))
    .pipe(gulp.dest('public'))
}

exports.compressJavaScript = compressJavaScript
exports.compressCSS = compressCSS
exports.compressHTML = compressHTML
exports.default = gulp.parallel(compressJavaScript, compressCSS, compressHTML)
