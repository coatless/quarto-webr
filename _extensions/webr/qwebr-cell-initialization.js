
const filteredEntries = qwebrCellDetails.filter(entry => {
  const contextOption = entry.options && entry.options.context;
  return ['interactive'].includes(contextOption);
});

filteredEntries.map(
  (entry) => {
   qwebrCreateHTMLElement(entry);
   qwebrCreateMonacoEditorInstance(entry);
  }
 )

// Release document status as ready
qwebrInstance.then(
  () => {

  if (qwebrShowStartupMessage) {
      qwebrStartupMessage.innerText = "🟢 Ready!"
    }
  }

)