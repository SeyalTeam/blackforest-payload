const qs = require('qs');
console.log(qs.parse('where[branch][in]=id1,id2'));
console.log(qs.parse('where[branch][in][0]=id1&where[branch][in][1]=id2'));
