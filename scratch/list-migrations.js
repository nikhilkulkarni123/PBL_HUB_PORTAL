const fs = require('fs');
const files = fs.readdirSync('db/migrations');
console.log(files);
