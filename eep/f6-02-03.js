module.exports=function(telegram) {
  var retValue = {};

  if (telegram['rawByte'][12] == '3') { // T21 and NU
    // message
    var dataField = parseInt(telegram.slice(2,4), 16);

    retValue[''] = false;



    switch(dataField) {
      case 0x30:
        retValue['A0'] = true;
        break;
      case 0x10:
        retValue['A0'] = false;
        retValue['A1'] = 'toggle';
        break;
      case 0x70:
        retValue['B0'] = true;
        retValue['B1'] = false;
        break;
      case 0x50:
        retValue['B0'] = false;
        retValue['B1'] = true;
        break;
      default:
        retValue['B0'] = false;
        retValue['B1'] = false;
        break;
    }
  }
  return retValue;
}
