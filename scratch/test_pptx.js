const officeparser = require('officeparser');
console.log('officeparser module:', officeparser);
console.log('parseOffice type:', typeof officeparser.parseOffice);
if (officeparser.default) {
  console.log('default parseOffice type:', typeof officeparser.default.parseOffice);
}
