var pallete = ["#3D4B38","#83D145","#BE5B2D","#82C1BD","#D8BD52","#7DC986","#807B3F"];

function animateThings(time) {
    $('[data-toggle="tooltip"]').tooltip({
        'placement': 'top'
    });

    if (time === undefined)
        time = 1500;
    var skillBar = $(document).find('.data-inner');
    skillBar.each(function() {
        var skillVal = $(this).attr("data-value");
        $(this).animate({
            height: skillVal
        }, time);
    });
}

$(document).ready(function() {
    animateThings();
    gatherData();
});

function gatherData() {
    var zabbix = new $.zabbix ('https://z.xpw.us/zabbix/api_jsonrpc.php', 'anon', 'Jvd6P4jh8Rn4M5Ts');
    if(zabbix.getApiVersion() != '2.2.2') {
        throw new Error('Zabbix has been updated, check the new documentation then update the code and Zabbix api version');
        //Long story short, I only wrote this for 2.2.2. I know the latest version is 2.4, and honestly, this MAY still work, but change it at your own risk
    }
    zabbix.authenticate(); //this gives us our API key, which gets assigned to the zabbix object

    setTimeout(function(){
        filterHostsAndOutput(zabbix);
        setInterval(function() { filterHostsAndOutput(zabbix) }, 15000);
    }, 500);
}

//I apologize for everything.

function filterHostsAndOutput(zabbix) {
    //console.log('kill me now');
    var hosts = zabbix.call('host.get', {
        "selectInventory": true,
        "selectItems": [
            "name",
            "lastvalue",
            "units"
        ],
        "output": "extend",
        "search" : {"host" : ""},
        "expandDescription": 1,
        "expandData": 1
    });

    var anError = 0;

    var totalMemFree = 0;
    var totalMem = 0;
    var totalCPU = 0;
    var totalCPUCores = 0;
    var totalProcesses = 0;

    $.each(hosts, function() {

        var thisHost = $(this);
        var thisHostObj = thisHost[0];

        thisHostObj.avgCpuLoad = 0;
        thisHostObj.networkTraffic = 0;
        $.each(thisHostObj.items, function() { //Parse the statistics to human-readable.
            if($(this)[0].name == 'Processor load (1 min average)') {
                thisHostObj.avgCpuLoad = parseFloat($(this)[0].lastvalue);
            }
            if($(this)[0].name == 'ICMP response time') {
                thisHostObj.agentPing = $(this)[0].lastvalue;
            }
            if($(this)[0].name == 'CPU Count') {
                thisHostObj.cpuCount = $(this)[0].lastvalue;
            }
            if($(this)[0].name == 'Free memory') {
                thisHostObj.freeMem = $(this)[0].lastvalue / 1024 / 1024; //MB
            }
            if($(this)[0].name == 'Total memory') {
                thisHostObj.totalMem = $(this)[0].lastvalue / 1024 / 1024;
            }
            if($(this)[0].name == 'Available memory') {
                thisHostObj.freeMem = $(this)[0].lastvalue / 1024 / 1024;
            }
            if($(this)[0].name == 'Number of processes') {
                thisHostObj.numProcesses = $(this)[0].lastvalue;
            }
            if($(this)[0].name == 'Incoming network traffic on $1') {
                thisHostObj.networkTraffic += ($(this)[0].lastvalue / 1024) / 8; // KBps
            }
            if($(this)[0].name == 'Outgoing network traffic on $1') {
                thisHostObj.networkTraffic += ($(this)[0].lastvalue / 1024) / 8; // KBps
            }
            if($(this)[0].name == 'HTTP service is running' && $(this)[0].lastvalue == 0) {
                thisHostObj.error = 1;
                thisHostObj.errorText = 'Web service is down (httpd or IIS)';
            }

        });

        totalMemFree += thisHostObj.freeMem;
        totalMem += thisHostObj.totalMem;
        totalCPUCores += thisHostObj.cpuCount;
        totalCPU += thisHostObj.avgCpuLoad;

        if (thisHostObj.error != '' && thisHostObj.error != 1) {
            thisHostObj.errorText = new String;
            thisHostObj.errorText = thisHostObj.error;
        }
        if(thisHostObj.errorText && thisHostObj.errorText.indexOf('Interrupted system call') > -1) {
            thisHostObj.errorText = 'Couldn\'t reach agent - check firewall settings';
        }
        if(thisHostObj.errorText && thisHostObj.errorText.indexOf('Connection refused') > -1) {
            thisHostObj.errorText = 'Connection refused - check agent settings';
        }
        if(thisHostObj.errorText && thisHostObj.errorText.indexOf('timed out') > -1) {
            thisHostObj.errorText = 'Connection timed out - this is where you panic';
        }
        if(thisHostObj.inventory.os) {
            if(thisHostObj.inventory.os.indexOf('Windows Server 2008 R2') > -1) {
                thisHostObj.os = 'Win Server 2008 R2';
            } else if (thisHostObj.inventory.os.indexOf('Windows Server 2012') > -1) {
                thisHostObj.os = 'Win Server 2012';
            } else if (thisHostObj.inventory.os.indexOf('Windows Server 2003') > -1) {
                thisHostObj.os = 'Win Server 2003';
            } else if (thisHostObj.inventory.os.indexOf('el7') > -1) {
                thisHostObj.os = 'CentOS 7';
            } else if (thisHostObj.inventory.os.indexOf('el6') > -1) {
                thisHostObj.os = 'CentOS 6.5';
            } else {
                thisHostObj.os = thisHost[0].inventory.os;
            }
        } else {
            thisHostObj.os = 'OS Unavailable';
        }

        thisHostObj.memPct = (thisHostObj.totalMem - thisHostObj.freeMem) / thisHostObj.totalMem;
        thisHostObj.agentPing = Math.round( thisHostObj.agentPing * 10 ) / 10;

        var info_box = $('#hosts-list').find('#'+thisHostObj.hostid);
        if (info_box.length <= 0) {
            info_box = $('#template-info-box').clone();
            info_box.attr('id', thisHostObj.hostid);
            info_box.appendTo('#hosts-list');
        }
        
        if(!thisHostObj.error) {
            if (info_box.find('#host').length<=0) {
                info_box.remove();
                info_box = $('#template-info-box').clone();
                info_box.attr('id', thisHostObj.hostid);
                info_box.appendTo('#hosts-list');
            }
        
            info_box.find('#host').text(thisHostObj.name);
            info_box.find('#os').text(thisHostObj.os);
            info_box.find('#ram').attr('data-value', (thisHostObj.memPct*100)+'%');
            info_box.find('#ram').parent().attr('title', 'RAM: '+Math.round(thisHostObj.memPct*100)+'%');
            info_box.find('#cpu').attr('data-value', (thisHostObj.avgCpuLoad/thisHostObj.cpuCount*100)+'%');
            info_box.find('#cpu').parent().attr('title', 'CPU: '+Math.round(thisHostObj.avgCpuLoad/thisHostObj.cpuCount*100)+'%');
            info_box.find('#cpupercent').text((thisHostObj.avgCpuLoad/thisHostObj.cpuCount*100).toFixed(2)+'%');
            info_box.find('#ramused').text(((thisHostObj.totalMem - thisHostObj.freeMem).toFixed(2)));
            info_box.find('#ramtotal').text(thisHostObj.totalMem.toFixed(0));
            info_box.find('#ping').text(thisHostObj.agentPing);
            info_box.find('#netusage').text(thisHostObj.networkTraffic.toFixed(1));
        } else {
            info_box.empty().append('<h3 style="text-align: center; font-weight: bolder">' +
                thisHostObj.name + '</h3><h4 style="font-weight: bolder">' + thisHostObj.errorText + '</h4>');
            anError = 1;
        }
        info_box.attr('style', '');

    });

    $('#loader').attr('style','display:none;');

    if ($('#main-panel').find('#status').length <= 0) {
        var main_panel = $('#template-main-panel').html();
        $('#main-panel').empty();
        main_panel.appendTo('#main-panel');

        main_panel.find('#status').text('OK');
        main_panel.find('#cputotal').text((totalCPU/totalCPUCores*100).toFixed(4)+'%');
        main_panel.find('#ramusedtotal').text((totalMem-totalMemFree).toFixed(1));
        main_panel.find('#ramtotal').text(totalMem.toFixed(1));
    }

    animateThings();

}