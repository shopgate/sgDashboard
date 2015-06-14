$(document).ready(function () {
	function initAfterAjax(context) {
		$(".switch", context).bootstrapSwitch();

		$('.switch', context).on('switchChange.bootstrapSwitch', function (event, state) {
			$(this).parents('.form-group:first').next('.color-settings').toggle($(this).is(':checked'));
		});

		$(".switch", context).trigger('switchChange.bootstrapSwitch');

	}


	$('.lighttrigger-modal-box').on('hide.bs.modal', function (e) {
		$('#add-new-lighttrigger').val("");
	})

	$('#add-new-lighttrigger').change(function () {

		$('.lighttrigger-modal-box form').html("Loading...");
		$('.lighttrigger-modal-box').modal('show');
		$.get('/admin/ajax_lighttrigger', {lighttrigger: $(this).val()}, function (data) {
			$('.lighttrigger-modal-box form').html(data);
			initAfterAjax($('.lighttrigger-modal-box form'));
		});

	})

	$('.edit-button').click(function () {
		$('.lighttrigger-modal-box form').html("Loading...");
		$('.lighttrigger-modal-box').modal('show');
		$.get('/admin/ajax_lighttrigger', {id: $(this).data('id')}, function (data) {
			$('.lighttrigger-modal-box form').html(data);
			initAfterAjax($('.lighttrigger-modal-box form'));
		});
	})

})

