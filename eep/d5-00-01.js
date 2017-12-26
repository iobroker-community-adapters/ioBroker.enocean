
module.exports=function(telegram) {
    // message
    var dataField = parseInt(telegram.slice(2,4), 16);
    var handleOpen = ((dataField & 0x01) == 0x00) ;
    var learnButton = ((dataField & 0x08) == 0x00) ;

    return {contact_status: handleOpen, learn_button: learnButton};
}
