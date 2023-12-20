// Store cell data
var qwebrCellDetails = {{QWEBRCELLDETAILS}};

const filteredEntries = qwebrCellDetails.filter(entry => {
  const contextOption = entry.options && entry.options.context;

  console.log('Detected entry with context: ' + contextOption);

  return ['interactive', 'output', 'setup'].includes(contextOption);
});

qwebrInstance.then(
  () => {
    console.log('test')
  }
)