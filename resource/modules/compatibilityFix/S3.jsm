moduleAid.VERSION = '1.0.1';

this.watchS3Bar = function() {
	if(prefAid.movetoTop && gFindBarInitialized && !gFindBar.hidden && typeof(moveTop) != 'undefined') {
		moveTop();
	}
};

moduleAid.LOADMODULE = function() {
	objectWatcher.addAttributeWatcher($('s3downbar_toolbar_panel'), 'collapsed', watchS3Bar);
};

moduleAid.UNLOADMODULE = function() {
	objectWatcher.removeAttributeWatcher($('s3downbar_toolbar_panel'), 'collapsed', watchS3Bar);
};
