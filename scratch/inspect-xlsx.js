const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function readZipEntries(buffer) {
  const entries = {};
  let offset = 0;
  while (offset < buffer.length - 4) {
    if (buffer.readUInt32LE(offset) === 0x04034b50) {
      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
      const dataStart = offset + 30 + nameLen + extraLen;
      const compData = buffer.slice(dataStart, dataStart + compSize);
      
      let uncompressed;
      if (compMethod === 0) {
        uncompressed = compData;
      } else if (compMethod === 8) {
        uncompressed = zlib.inflateRawSync(compData);
      }
      entries[name] = uncompressed ? uncompressed.toString('utf8') : '';
      offset = dataStart + compSize;
    } else {
      offset++;
    }
  }
  return entries;
}

try {
  const filePath = path.join(__dirname, '..', 'source-data', 'GMIT_Students_Normalized_V5.xlsx');
  const buf = fs.readFileSync(filePath);
  const zip = readZipEntries(buf);
  const sheetXml = zip['xl/worksheets/sheet1.xml'] || '';

  // Extract all rows
  const rowRegex = /<(?:x:)?row[^>]*>(.*?)<\/(?:x:)?row>/gs;
  const rows = [];
  let rMatch;
  while ((rMatch = rowRegex.exec(sheetXml)) !== null) {
    const cellRegex = /<(?:x:)?c r="([A-Z]+)(\d+)"[^>]*>(?:<(?:x:)?v>(.*?)<\/(?:x:)?v>)?<\/(?:x:)?c>/gs;
    let cMatch;
    const row = {};
    while ((cMatch = cellRegex.exec(rMatch[1])) !== null) {
      row[cMatch[1]] = cMatch[3] !== undefined ? cMatch[3] : '';
    }
    rows.push(row);
  }

  console.log('Total rows parsed:', rows.length);
  console.log('Header row (Row 1):', JSON.stringify(rows[0]));
  console.log('First data row (Row 2):', JSON.stringify(rows[1]));
  console.log('Second data row (Row 3):', JSON.stringify(rows[2]));
  console.log('Last data row:', JSON.stringify(rows[rows.length - 1]));

  // Map header row
  const headers = rows[0];
  const dataRows = rows.slice(1).map(r => {
    const obj = {};
    for (const [col, val] of Object.entries(r)) {
      const headerName = headers[col] || col;
      obj[headerName] = val;
    }
    return obj;
  });

  console.log('\nData rows count:', dataRows.length);
  console.log('Sample mapped row:', JSON.stringify(dataRows[0], null, 2));

  // Count by Semester
  const semCounts = {};
  dataRows.forEach(r => {
    const sem = r['Semester'] || r['Sem'] || 'Unknown';
    semCounts[sem] = (semCounts[sem] || 0) + 1;
  });
  console.log('Semester distribution:', semCounts);

  // Normalize into standard format: usn, name, semester, section
  const normalized = dataRows.map(r => ({
    institution: r['Institution'] || 'GMIT',
    academic_year: r['Academic Year'] || '2026-27',
    season: r['Season'] || 'ODD',
    usn: (r['USN'] || '').trim().toUpperCase(),
    name: (r['Name'] || r['Student Name'] || '').trim(),
    semester: Number(r['Semester'] || r['Sem']),
    section: (r['Section'] || 'A').trim().toUpperCase(),
  }));

  // Save to seed-data/gmit_students.json and source-data/gmit_students.csv
  const jsonPath = path.join(__dirname, '..', 'seed-data', 'gmit_students.json');
  fs.writeFileSync(jsonPath, JSON.stringify(normalized, null, 2));
  console.log(`Saved ${normalized.length} normalized students to ${jsonPath}`);

  const csvHeader = 'USN,Name,Semester,Section,Institution,Academic Year,Season\n';
  const csvRows = normalized.map(s => 
    `"${s.usn}","${s.name.replaceAll('"', '""')}",${s.semester},"${s.section}","${s.institution}","${s.academic_year}","${s.season}"`
  ).join('\n');
  const csvPath = path.join(__dirname, '..', 'source-data', 'gmit_students.csv');
  fs.writeFileSync(csvPath, csvHeader + csvRows + '\n');
  console.log(`Saved CSV to ${csvPath}`);

} catch (e) {
  console.error('Error:', e);
}
