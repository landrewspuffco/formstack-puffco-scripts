<script>
function checkFields() {
    var shouldHide = false;
    var q1 = document.querySelector('input[name="field193223364"]:checked');
    if (q1 && q1.value === "Yes") shouldHide = true;
    var q2 = document.querySelector('input[name="field193222972"]:checked');
    if (q2 && q2.value === "No") shouldHide = true;
    var q3 = document.querySelector('select[name="field192712645"]');
    if (q3 && q3.value === "becoming_a_puffco_retailer") shouldHide = true;
    if (shouldHide) {
        document.body.classList.add("hide-submit");
    } else {
        document.body.classList.remove("hide-submit");
    }
}

function waitForField() {
    var radios = document.querySelectorAll('input[name="field193223364"], input[name="field193222972"]');
    var dropdown = document.querySelector('select[name="field192712645"]');
    
    if (radios.length === 0 || !dropdown) {
        setTimeout(waitForField, 500);
        return;
    }

    radios.forEach(function(radio) {
        radio.addEventListener("change", function() {
            checkFields();
        });
    });

    dropdown.addEventListener("change", function() {
        checkFields();
    });
}

function FF_OnNextPage() { checkFields(); }
function FF_OnPreviousPage() { checkFields(); }
waitForField();
</script>
