

$(document).ready(function () {
    console.log('main.js loaded');
    var start_time = new Date().getTime();

    // var DEBUG_MODE = true;
    var DEBUG_MODE = false;
    var LOG_LINES = 10;

    $(document).keydown(function (e) {
        var keycode = parseInt(e.keyCode);
        var allowed = [37, 38, 39, 40, 32, 67, 88]; // left,up,right,down,space, c,x
        if (allowed.indexOf(keycode) > -1) {
            var max_speed;
            e.preventDefault();
            //up,down
            if (keycode == 38 || keycode == 40) {
                max_speed = parseInt($("#max_speed").slider('value'));
                if ($('#max_speed').data('pressed3840')) {
                    console.log('pressed3840 detected');
                    return true;
                }

                $('#max_speed').data('pressed3840', true);
                $('#enapwm').slider('value', max_speed * 10);
                $('#enbpwm').slider('value', max_speed * 10);
                $('input[name=direction][value=' + (39 - keycode).toString() + ']').prop('checked', true);
                $("#update_pwm").click();
            }

            //left,right
            if (keycode == 37 || keycode == 39) {
                max_speed = parseInt($("#max_speed").slider('value'));
                var max_angle = parseInt($("#max_angle").slider('value'));

                if ($('#max_angle').data('pressed3739')) {
                    console.log('pressed3739 detected')
                    return true;
                }
               // console.log("turn pressed", keycode, max_speed, max_angle);

                $('#max_angle').data('pressed3739', true);
                //var pwmvalue = parseInt(max_speed * 10 * max_angle / 100);
                //console.log("turn pwmvalue", pwmvalue)

                var pwmvalue = Math.min(max_angle, max_speed) * 10;

                if (keycode == 37) {
                    $('#enapwm').slider('value', pwmvalue);
                }
                else {
                    $('#enbpwm').slider('value', pwmvalue);
                }
                $("#update_pwm").click();
            }
        }
    });

    $(document).keyup(function (e) {
        var keycode = parseInt(e.keyCode);
        console.log('keyup: keycode', keycode);
        var allowed = [37, 38, 39, 40, 32, 67, 88]; // left,up,right,down,space, c,x
        if (allowed.indexOf(keycode) > -1) {
            e.preventDefault();
            console.log('allowed', keycode);


            //left,right
            if (keycode == 37 || keycode == 39) {
                $('#max_angle').data('pressed3739', false);
                var ena = $('#enapwm').slider('value');
                var enb = $('#enbpwm').slider('value');

                var max_angle = parseInt($('#max_angle').slider('value'));
                var max_speed = parseInt($("#max_speed").slider('value'));


                var max_val = Math.max(ena, enb);
                var min_val = Math.min(ena, enb);

                //console.log("lr turn pressedkeyup", max_val, min_val, max_angle, max_speed)

                if (min_val == 0 && max_angle > 0) { // releasing left/right when motors off
                    $('#enapwm').slider('value', 0);
                    $('#enbpwm').slider('value', 0);
                }
                else {
                    $('#enapwm').slider('value', max_val);
                    $('#enbpwm').slider('value', max_val);
                }

                $("#update_pwm").click();
            }

            if (keycode == 38 || keycode == 40) {
                $('#max_speed').data('pressed3840', false);
                $('#enapwm').slider('value', 0);
                $('#enbpwm').slider('value', 0);
                $("#update_pwm").click();
            }


            if (keycode == 32) {
                $("#stop_btn").click();
            }
            if (keycode == 67) {
                //$('#turn_slider').slider('value',0);
            }

            if (keycode == 88) {
                // $('#slider-vertical').slider('value', -1 * $('#slider-vertical').slider('value'));
            }
        }
    });


    var max_speed_custom_handle = $("#max_speed_custom_handle");
    $("#max_speed").slider({
        min: 0,
        max: 100,
        step: 1,
        value: 50,
        create: function () {
            max_speed_custom_handle.text($(this).slider("value"));
        },
        slide: function (event, ui) {
            max_speed_custom_handle.text(ui.value);
        },
        change: function () {
            $('.custom-handle').blur()
        }
    });


    $("#update_pwm").click(function () {
        var ena = $("#enapwm").slider('value'),
            enb = $("#enbpwm").slider('value'),
            direction = $('input[name=direction]:checked').val(),
            rand = get_random_string();

        start_ts = new Date().getTime();

        var payload = {
            ena: ena,
            enb: enb,
            direction: direction,
            rand: rand
        };

        insert_pwm_data(ena, enb);
        var html_log_row = create_log_line(payload);
        if (DEBUG_MODE == true) {
            return true;
        }

        $.ajax({
            type: 'GET',
            url: '/pwm',
            data: payload,
            success: function (resp) {
                console.log(resp);

            },
            error: function (e) {
                console.log(e)
            }, complete: function (r) {
                var status = r.status;
                var resp = r.responseJSON;
                var end_ts = new Date().getTime();
                var req_time = end_ts - start_ts;
                var duration = duration;
                var millis = resp.millis;

                var tr = $("#logs_container tr.active").first(),
                    th = tr.find('th');
                if (th.length) {
                    var prev_millis = parseInt(th.text());
                    duration = millis - prev_millis;
                    $('td[role="duration"]').first().text(duration);
                }

                console.log("[update_pwm] complete", resp);
                html_log_row = html_log_row
                    .replace("__STATUS__", status)
                    .replace("__RESP_TIME__", req_time)
                    .replace("__DATE__", millis)
                    .replace("__DURATION__", 0);

                $("#logs_container table tbody").prepend($(html_log_row));
                insert_response_time_data(req_time);

                if (r.status == 200) {
                    var tmp = $("tr.active").toArray();
                    tmp.splice(LOG_LINES, tmp.length);
                    $("#logs_container table tbody").empty().append($(tmp));
                }
            }
        });
    });


    var create_log_line = function (payload, req_id) {
        var log_row_tpl = '<tr class="active" data-request-id="__REQ_ID__">' +
            '<th scope="row" role="date">__DATE__</th>' +
            '<td>__ENA__</td>' +
            '<td>__ENB__</td>' +
            '<td role="resp_time" >__RESP_TIME__</td>' +
            '<td>__DIRECTION__</td>' +
            '<td role="status">__STATUS__</td>' +
            '<td role="duration">__DURATION__</td></tr>';


        var str = log_row_tpl.replace('__REQ_ID__', payload.rand)
            .replace('__ENA__', payload.ena)
            .replace('__ENB__', payload.enb)
            .replace('__DIRECTION__', payload.direction)
        //.replace('__DURATION__', 0);

        var ts = new Date().getTime();

        if (DEBUG_MODE == true) {
            var req_time = get_random_number(50, 500)
            str = str
                .replace("__STATUS__", "EMULATED")
                .replace("__RESP_TIME__", req_time)
                .replace("__DATE__", ts - start_time)
                .replace("__DURATION__", 0)

            insert_response_time_data(req_time);
            $("#logs_container table tbody").prepend($(str));


            var tmp = $("tr.active").toArray();
            tmp.splice(10, tmp.length)
            $("#logs_container table tbody").empty().append($(tmp))
        }

        return str;
    };

    $('#stop_btn').on('click', function () {
        $("#enapwm").slider('value', 0);
        $("#enbpwm").slider('value', 0);
        $("#update_pwm").click();
    });

    var pwm_data = {
        series: [{
            name: 'ena',
            data: []
        }, {
            name: 'enb',
            data: []
        }]
    };

    var chartist_options = {
        fullWidth: true,
        low: 0,
        high: 100,
        // Within the series options you can use the series names
        // to specify configuration that will only be used for the
        // specific series.
        series: {
            'ena': {
                lineSmooth: Chartist.Interpolation.step(),
                showArea: true,
                showPoint: false
            },
            'enb': {
                lineSmooth: Chartist.Interpolation.step(),
                showArea: true,
                showPoint: false
            }
        },
        axisX: {
            type: Chartist.FixedScaleAxis,
            divisor: 5,
            // labelInterpolationFnc: function (value) {
            //      return moment(value).format('HH:mm:ss');
            //  }
        }
    };


    //Sliders

    var init_sliders = function () {
        var max_angle_custom_handle = $("#max_angle_custom_handle");
        $("#max_angle").slider({
            min: 0,
            max: 100,
            step: 1,
            value: 20,
            create: function () {
                max_angle_custom_handle.text($(this).slider("value"));
            },
            slide: function (event, ui) {
                max_angle_custom_handle.text(ui.value);
            },
            change: function () {
                $('.custom-handle').blur()
            }
        });

        var enapwm_custom_handle = $("#enapwm_custom_handle");
        $("#enapwm").slider({
            min: 0,
            max: 1000,
            step: 50,
            value: 0,
            create: function () {
                enapwm_custom_handle.text($(this).slider("value"));
            },
            slide: function (event, ui) {
                enapwm_custom_handle.text(ui.value);
            },
            change: function (event, ui) {
                enapwm_custom_handle.text(ui.value);
                $('.custom-handle').blur()
            }
        });


        var enbpwm_custom_handle = $("#enbpwm_custom_handle");
        $("#enbpwm").slider({
            min: 0,
            max: 1000,
            step: 50,
            value: 0,
            create: function () {
                enbpwm_custom_handle.text($(this).slider("value"));
            },
            slide: function (event, ui) {
                enbpwm_custom_handle.text(ui.value);
            },
            change: function (event, ui) {
                enbpwm_custom_handle.text(ui.value);
                $('.custom-handle').blur()
            }
        });
    }
    init_sliders();

    //Charts


    var init_chart = function () {
        return new Chartist.Line('.test-pwm-chart', pwm_data, chartist_options);
    };

    var chart = init_chart();
    var pwm_chart_length = 10;

    var insert_pwm_data = function (ena, enb, date) {
        var date = date || new Date().getTime();

        pwm_data.series[0].data.splice(0, pwm_data.series[0].data.length - pwm_chart_length);
        pwm_data.series[1].data.splice(0, pwm_data.series[1].data.length - pwm_chart_length);
        var since = parseFloat((date - start_time) / 1000).toFixed(1)
        pwm_data.series[0].data.push({
            x: since,
            y: parseInt(ena / 10)
        });


        pwm_data.series[1].data.push({
            x: since,
            y: parseInt(enb / 10)
        });
        chart.update()

    };


    var resp_time_chart_data = {
        series: [{
            name: 'resp_time',
            data: []
        }]
    };


    var resp_time_chart_options = {
        fullWidth: true,
        chartPadding: {
            right: 10
        },
        showPoint: false,
        low: 0,
        fillHoles: true,
        axisX: {
            type: Chartist.FixedScaleAxis,
            divisor: 5,
            // labelInterpolationFnc: function (value) {
            //     return moment(value).format('HH:mm:ss');
            //  }
        }
    };

    var init_response_time_chart = function () {
        return new Chartist.Line('.response-time-chart', resp_time_chart_data, resp_time_chart_options);
    };

    var insert_response_time_data = function (time_ms, date) {
        var date = date || new Date().getTime();
        var since = parseFloat((date - start_time) / 1000).toFixed(1);
        var response_time_chart_length = 100;
        resp_time_chart_data.series[0].data.splice(0, resp_time_chart_data.series[0].data.length - response_time_chart_length);
        resp_time_chart_data.series[0].data.push({
            x: since,
            y: time_ms
        })
        response_time_chart.update();
    };

    var response_time_chart = init_response_time_chart();



    var get_random_number = function (minimum, maximum) {
        return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum
    };

    var get_random_string = function () {
        return Math.random().toString(36).slice(2); //10-11 chars str
    };
});