
module.exports=function(telegram) {
  var retValue = {};

  if (telegram[12] == '2') { // T21 and NU
      // message
      var dataField = parseInt(telegram.slice(2,4), 16);
      var handleOpen = ((dataField & 0xD0) == 0xC0) ;
      var handleTilt = ((dataField & 0xF0) == 0xD0) ;

      if (handleOpen) {
          retValue = {window_handle: 1};
      } else if (handleTilt) {
          retValue = {window_handle: 2};
      } else {
          retValue = {window_handle: 0};
      }
  }
  return retValue;
}
