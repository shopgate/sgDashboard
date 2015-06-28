$(document).ready(function () {

	$('.btn.delete-confirm').click(function () {
		var _this = this;
		bootbox.confirm('Do you really want to delete this item?', function (result) {
			if (result) {
				window.location = $(_this).data('url');
			}
		})
	})

});


