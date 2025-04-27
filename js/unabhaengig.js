//Globale Variablen
var tablesReady = false;

var ratio_pv = 1;
var ratio_bat = 1;

var eigen = 0.25;
var autark = 0.25;
var dir_eigen = 0.1;
var dir_autarkie = 0.1;

var last_start = 6000;
var pv_start = 10;
var bat_start = 6;

var chartEigen;
var chartAutark;

var cfg = {};

// Dark mode recognition
let dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
if (dark) { // Flussgrafik an Theme anpassen
    $(".flussgrafik").attr("src", "images/unabhaengigkeitsrechner-energiefluesse-dark.svg");
}
// Switch light/dark mode recognition
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",
    e => e.matches && pageReload()
);
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change",
    e => e.matches && pageReload()
);

function pageReload() {
    location.reload();
}

//Setup für Ajax Requests (getJSON, getScript etc.)
$.ajaxSetup({
    cache: true,
    beforeSend: function(jqXHR) {
        jqXHR.overrideMimeType("application/json;charset=UTF-8");
    }
});

//Config-Datei laden
$.getJSON('js/config.json', function(data) {
        cfg = data;
    })
    .then(function() {
        if (cfg["showFullHeaderLinks"]) {
            $(".showOnlyOnFullHeader").show();
        }
        if (cfg["debug"]) {
            $(".showOnlyOnDebug").show();
        }
    })

//Tabellen mit Werten laden
//Erst wenn die Tabellen geladen sind, gehts los mit GetResults
$.getJSON('js/tabelleEigenverbrauch.json', function(dataE) {
    tabelleEigenverbrauch = dataE;
    $.getJSON('js/tabelleAutarkie.json', function(dataA) {
        tabelleAutarkie = dataA;
        tablesReady = true;
        GetResults();
        SetCharts();
    }).fail(function() {
        console.log('error: tabelleAutarkie.json not loaded');
    });
}).fail(function() {
    console.log('error: tabelleEigenverbrauch.json not loaded');
}).then(function() {
    $('#loading').hide();
});


//Initialisierung und Event-Handler für Last-Slider
$(function() {
    $('#slider-range-last').slider({
        range: 'min',
        value: last_start,
        min: 2000,
        max: 10000,
        step: 100,
        slide: function(event, ui) {
            var formattedValue = FormatNumber(ui.value);
            $('#amount-last').val(formattedValue);
            SetRatioPV(ui.value, $('#slider-range-pv').slider('value') / 10);
            SetRatioBat(ui.value, $('#slider-range-bat').slider('value'));
            GetResults();
        }
    });

});

//Initialisierung und Event-Handler für PV-Slider
$(function() {
    $('#slider-range-pv').slider({
        range: 'min',
        value: pv_start * 10,
        min: 1,
        max: 200,
        step: 1,
        slide: function(event, ui) {
            var formattedValue = FormatNumber(ui.value / 10);
            $('#amount-pv').val(formattedValue);
            SetRatioPV($('#slider-range-last').slider('value'), ui.value / 10);
            GetResults();
        }
    });
});

//Initialisierung und Event-Handler für Batterie-Slider
$(function() {
    $('#slider-range-bat').slider({
        range: 'min',
        value: bat_start,
        min: 0,
        max: 20,
        step: 0.1,
        slide: function(event, ui) {
            var formattedValue = FormatNumber(ui.value);
            $('#amount-bat').val(formattedValue);
            SetRatioBat($('#slider-range-last').slider('value'), ui.value);
            GetResults();
        }
    });
});

//Event-Handler für Text-Input Stromverbrauch
$(function() {
    $('#amount-last').on('change', function() {

        var formattedValue = $('#amount-last').val();
        var invariantValue = GetFormattedNumber(formattedValue);
        var min = $('#slider-range-last').slider('option', 'min');
        var max = $('#slider-range-last').slider('option', 'max');

        if (!IsNumber(invariantValue) || invariantValue < min || invariantValue > max) {
            alert('Bitte geben Sie einen gültigen Stromverbrauch im Bereich von ' + min + ' bis ' + max + ' kWh ein.');
            invariantValue = last_start;
            formattedValue = FormatNumber(invariantValue);
        }

        $('#amount-last').val(formattedValue);
        $('#slider-range-last').slider('value', invariantValue);

        SetRatioPV($('#slider-range-last').slider('value'), $('#slider-range-pv').slider('value') / 10);
        SetRatioBat($('#slider-range-last').slider('value'), $('#slider-range-bat').slider('value'));
        GetResults();
    });
});

//Event Handler für Text-Input PV
$(function() {
    $('#amount-pv').on('change', function() {

        var formattedValue = $('#amount-pv').val(); // "13,3"
        var invariantValue = GetFormattedNumber(formattedValue); // "13.3"
        invariantValue = parseFloat(invariantValue) * 10; // 133
        var min = $('#slider-range-pv').slider('option', 'min'); // 1
        var max = $('#slider-range-pv').slider('option', 'max'); // 200

        if (!IsNumber(invariantValue) || invariantValue < min || invariantValue > max) {
            alert('Bitte geben Sie eine gültige PV-Leistung im Bereich von ' + min / 10 + ' bis ' + max / 10 + ' kW ein.');
            invariantValue = pv_start * 10;
            formattedValue = FormatNumber(invariantValue);
        }

        $('#amount-pv').val(formattedValue);
        $('#slider-range-pv').slider('value', invariantValue);

        SetRatioPV($('#slider-range-last').slider('value'), $('#slider-range-pv').slider('value') / 10);
        GetResults();
    });
});

//Event Handler für Text-Input Batterie
$(function() {
    $('#amount-bat').on('change', function() {

        var formattedValue = $('#amount-bat').val();
        var invariantValue = GetFormattedNumber(formattedValue);
        var min = $('#slider-range-bat').slider('option', 'min');
        var max = $('#slider-range-bat').slider('option', 'max');

        if (!IsNumber(invariantValue) || invariantValue < min || invariantValue > max) {
            alert('Bitte geben Sie eine gültige Batteriekapazität im Bereich von ' + min + ' bis ' + max + ' kWh ein.');
            invariantValue = bat_start;
            formattedValue = FormatNumber(invariantValue);
        }

        $('#amount-bat').val(formattedValue);
        $('#slider-range-bat').slider('value', invariantValue);

        SetRatioBat($('#slider-range-last').slider('value'), $('#slider-range-bat').slider('value'));
        GetResults();
    });
});

//Hilfsfunktion, die feststellt, ob die Textfeldeingabe eine Zahl war
function IsNumber(input) {
    return !isNaN(parseFloat(input)) && isFinite(input);
}

//Auslesen der URL Parameter und setzen der initialen Werte
//Wird einmal beim Laden der Seite aufgerufen
$(function() {
    var l = GetParameterByName('load');
    if (IsNumber(l)) {
        last_start = l;
        $('#slider-range-last').slider('value', last_start);
    }
    var p = GetParameterByName('pv');
    if (IsNumber(p)) {
        pv_start = p;
        $('#slider-range-pv').slider('value', pv_start * 10);
    }
    var b = GetParameterByName('bat');
    if (IsNumber(b)) {
        bat_start = b;
        $('#slider-range-bat').slider('value', bat_start);
    }

    $('#amount-last').val(FormatNumber(last_start));
    $('#amount-pv').val(FormatNumber(pv_start));
    $('#amount-bat').val(FormatNumber(bat_start));
    SetRatioPV($('#slider-range-last').slider('value'), $('#slider-range-pv').slider('value') / 10);
    SetRatioBat($('#slider-range-last').slider('value'), $('#slider-range-bat').slider('value'));

});

function GetParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

//Aktivieren der Tooltips
$(function() {
    $(document).tooltip();
});

//Hilfsfunktion zum Berechnen des Verhältnisses PV/Last
function SetRatioPV(last, pv) {
    ratio_pv = GetProzentLabels(pv / last * 1000);
}

//Hilfsfunktion zum Berechnen des Verhältnisses Bat/Last
function SetRatioBat(last, bat) {
    ratio_bat = GetProzentLabels(bat / last * 1000);
}


//Funktion zum Interpolieren aus Matrix
function SucheWertAusMatrix(table, x, y) {

    //x-Index suchen
    var xi = Math.ceil(x / 0.0625) + 1;
    //y-Index suchen
    var yi = Math.ceil(y / 0.0625) + 1;

    var obenLinks = table[yi - 1][xi - 1];
    var obenRechts = table[yi - 1][xi];
    var untenLinks = table[yi][xi - 1];
    var untenRechts = table[yi][xi];

    var xInterpoliertOben = obenLinks + (x - table[0][xi - 1]) * (obenRechts - obenLinks) / (table[0][xi] - table[0][xi - 1]);
    var xInterpoliertUnten = untenLinks + (x - table[0][xi - 1]) * (untenRechts - untenLinks) / (table[0][xi] - table[0][xi - 1]);
    if (yi > 1) {
        var interpoliert = xInterpoliertOben + (y - table[yi - 1][0]) * (xInterpoliertUnten - xInterpoliertOben) / (table[yi][0] - table[yi - 1][0]);
        return interpoliert;
    }
    return xInterpoliertUnten;

}

//Funktion zum Ermitteln aller Ergebnisgrößen
//setzt auch die Grafiken und die Texte
function GetResults() {
    if (!tablesReady) {
        return;
    }
    GetEigenverbrauch();
    GetAutarkie();
    GetDirektverbrauchEigen();
    GetDirektverbrauchAutarkie();
    SetCharts();
    SetCenterLabels();
    ResetCopyLink();
}

//Funktion zum Ermitteln des Eigenverbrauchsanteils
function GetEigenverbrauch() {
    eigen = SucheWertAusMatrix(tabelleEigenverbrauch, ratio_pv, ratio_bat);
}

//Funktion zum Ermitteln des Autarkiegrades
function GetAutarkie() {
    autark = SucheWertAusMatrix(tabelleAutarkie, ratio_pv, ratio_bat);
}

//Funktion zum Ermitteln des Direktsanteils vom Eigenverbrauch
function GetDirektverbrauchEigen() {
    dir_eigen = SucheWertAusMatrix(tabelleEigenverbrauch, ratio_pv, 0);
}

//Funktion zum Ermitteln des Direktsanteils vom Autarkiegrad
function GetDirektverbrauchAutarkie() {
    dir_autarkie = SucheWertAusMatrix(tabelleAutarkie, ratio_pv, 0);
}

//Hilfsfunktion zum Runden auf beliebige Nachkommastellen
function GetProzent(wert, nachkomma) {
    var digiter = Math.pow(10, nachkomma);
    return Math.round(wert * 100 * digiter) / digiter;
}

//Hilfsfunktion zum Runden auf 2 Nachkommastellen für die Charts
function GetProzentCharts(wert) {
    return GetProzent(wert, 2);
}

//Hilfsfunktion zum Runden auf 4 Nachkommastellen
function GetProzentLabels(wert) {
    return GetProzent(wert, 4) / 100;
}

// Functie om de grafieken in te stellen
function SetCharts() {

    Chart.defaults.font.family = 'HTWBerlin';
    Chart.defaults.plugins.title.display = false; //true;
    Chart.defaults.plugins.title.font.size = 19;
    Chart.defaults.plugins.title.font.weight = 'normal';
    if (dark) {
        Chart.defaults.plugins.title.color = '#FFFFFF';
    } else {
        Chart.defaults.plugins.title.color = '#000000';
    }

    Chart.defaults.plugins.tooltip.displayColors = false;
    Chart.defaults.responsive = false;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation = false;

    /* Kleuren voor Donkere Modus */
    var borderCol;
    if (dark) {
        borderCol = 'rgba(56, 56, 56, 1)';
    } else {
        borderCol = 'rgba(255, 255, 255, 1)';
    }

    if (chartEigen) {
        chartEigen.destroy();
    }

    var ctx = document.getElementById('chart-eigen');
    chartEigen = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                label: ['Direct verbruik', 'Batterij laden', 'Teruglevering aan net'],
                data: [GetProzentCharts(dir_eigen), GetProzentCharts(eigen - dir_eigen), GetProzentCharts(1 - eigen)],
                backgroundColor: [
                    '#FFC000',
                    '#76B500',
                    '#BFBFBF'
                ],
                borderColor: [
                    borderCol,
                    borderCol,
                    borderCol
                ],
                borderWidth: 4
            }]
        },
        options: {
            plugins: {
                title: {
                    text: 'Zelfverbruiksaandeel'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label[context.dataIndex] +
                                ": " + FormatNumber(Math.round(10 * context.dataset.data[context.dataIndex]) / 10) + " %";
                        }
                    },
                    backgroundColor: '#FFF',
                    bodyFontStyle: 'normal',
                    bodyFont: { size: 15 },
                    bodyColor: '#000',
                }
            }
        }
    });

    if (chartAutark) {
        chartAutark.destroy();
    }

    var ctx = document.getElementById('chart-autark');
    chartAutark = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                label: ['Direct verbruik', 'Batterij ontladen', 'Netafname'],
                data: [GetProzentCharts(dir_autarkie), GetProzentCharts(autark - dir_autarkie), GetProzentCharts(1 - autark)],
                backgroundColor: [
                    '#FFC000',
                    '#336600',
                    '#595959'
                ],
                borderColor: [
                    borderCol,
                    borderCol,
                    borderCol
                ],
                borderWidth: 4
            }]
        },
        options: {
            plugins: {
                title: {
                    text: 'Mate van onafhankelijkheid'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label[context.dataIndex] +
                                ": " + FormatNumber(Math.round(10 * context.dataset.data[context.dataIndex]) / 10) + " %";
                        }
                    },
                    backgroundColor: '#FFF',
                    bodyFontStyle: 'normal',
                    bodyFont: { size: 15 },
                    bodyColor: '#000',
                }
            }
        }
    });

}

//Hilfsfunktion zum Formatieren von Zahlen mit korrektem Dezimaltrennzeichen
//bei cfg["culture"] == "de" werden Kommata verwendet, bei "en" Punkte
var numberFormatterWithMin1Digit = new Intl.NumberFormat(cfg["culture"], { useGrouping: false, minimumFractionDigits: 1 });
var numberFormatterWithoutDigit = new Intl.NumberFormat(cfg["culture"], { useGrouping: false, minimumFractionDigits: 0 });

function FormatNumber(number) {
    return number > 100 ? numberFormatterWithoutDigit.format(number) : numberFormatterWithMin1Digit.format(number);
}

//Hilfsfunktion zum Ermitteln der Zahlenwerte aus formatierten Strings
function GetFormattedNumber(numberAsString) {
    if (FormatNumber(1.2).includes(",")) {
        return numberAsString.replace(",", ".");
    }
    return numberAsString;
}

//Setzt die Prozent-Werte in die Labels in den Charts
function SetCenterLabels() {
    $('#cveigen').text('' + GetProzent(eigen, 0) + ' %');
    $('#cvautark').text('' + GetProzent(autark, 0) + ' %');

    SetOffsetCenterLabels(eigen, "cveigen");
    SetOffsetCenterLabels(autark, "cvautark");
}

//Passt den Offset des Center Labels an die Anzahl der Vorkommastellen an
function SetOffsetCenterLabels(valCenterLabel, idCenterLabel) {
    var offset;
    if (Math.round(valCenterLabel * 100) == 100) {
        offset = 32;
    } else if (Math.round(valCenterLabel * 100) >= 10) {
        offset = 25;
    } else {
        offset = 17;
    }
    document.getElementById(idCenterLabel).style.setProperty('left', 'calc(50% - ' + offset + 'px)');
}

function ResetCopyLink() {
    $("#copy-alert").html("Link kopieren");
    $("#checkmark-copied-icon").attr("src", "images/copy.svg");
}

$("#copy-link").click(function() {
    CopyLinkToClipboard();
    $("#copy-alert").html("Link kopiert!  ");
    $("#checkmark-copied-icon").attr("src", "images/checkmark.svg");
});

//Hilfsfunktion Link erstellen
function CopyLinkToClipboard() {
    var last = GetFormattedNumber($('#amount-last').val()).replace(".", "");
    var bat = GetFormattedNumber($('#amount-bat').val());
    var pv = GetFormattedNumber($('#amount-pv').val());
    var link = "https://solar.htw-berlin.de/rechner/unabhaengigkeitsrechner/?load=" + last + "&pv=" + pv + "&bat=" + bat;
    navigator.clipboard.writeText(link);

}