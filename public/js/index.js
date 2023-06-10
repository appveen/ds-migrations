(async () => {
    $("#securityKeys").on('click', function (ev) {
        $("#securityKeys")
        $.ajax({
            url: 'api/migrate/securityKeys',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({}),
            success: function (data, status) {
                console.log(data, status);
            },
            error: function (res, status) {
                console.log(res, status);
            }
        })
    });
    $("#dataService").on('click', function (ev) {
        $.ajax({
            url: 'api/migrate/dataService',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({}),
            success: function (data, status) {
                console.log(data, status);
            },
            error: function (res, status) {
                console.log(res, status);
            }
        })
    });
    $("#libraries").on('click', function (ev) {
        $.ajax({
            url: 'api/migrate/libraries',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({}),
            success: function (data, status) {
                console.log(data, status);
            },
            error: function (res, status) {
                console.log(res, status);
            }
        })
    });
})();