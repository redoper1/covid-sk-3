const elementContains = (selector, pattern) => {
    const node = document.querySelectorAll(selector);
    if (node.length == 1) {
        if (node[0].textContent.includes(pattern)) {
            return node[0];
        }
    } else if (node.length > 1) {
        let rightNode = null;
        node.forEach(function(value, index) {
            if (value.textContent.includes(pattern)) {
                rightNode = value;
            }
        });
        return rightNode;
    }
}

function getDockElementNumber(node) {
    return node !== null ? node.closest('.dock-element').querySelector('.responsive-text-label text').textContent.replace(',', '') : null;
}

module.exports = {
    elementContains,
    getDockElementNumber
}