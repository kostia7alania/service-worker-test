/*
// 1. Создаём новый объект XMLHttpRequest
var xhr = new XMLHttpRequest();
// 2. Конфигурируем его: GET-запрос на URL 'phones.json'
xhr.open('GET', '/img/1.jpg', false);
xhr.send(); // 3. Отсылаем запрос
if (xhr.status != 200) { // 4. Если код ответа сервера не 200, то это ошибка
    alert(xhr.status + ': ' + xhr.statusText); // пример вывода: 404: Not Found
} else {
    alert(xhr.responseText); // responseText -- текст ответа.
}*/

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive 
}

document.querySelector('.refresh').onclick = () => {
    const btn = event.target
    btn.textContent = 'Loading...'
    const usedImgs = [];
    const promises = [...document.querySelectorAll('.img')]
        .map(img => {
            let randImg;
            while (true) {
                randImg = getRandomIntInclusive(1, 32)
                if (!usedImgs.includes(randImg)) {
                    usedImgs.push(randImg)
                    break;
                }
            }
            const promise = new Promise((res, rej) => {
                img.onload = res
                img.onerror = rej
            })
            img.src = `/img/${randImg}.jpg`
            const rem = evt => removeFromDom(evt.target);
            img.onclick = rem
            return promise
        })
    Promise
        .all(promises)
        .then(e => btn.textContent = 'Refresh')
        .catch(err => btn.textContent = 'Images loaded with Error(s)')
}



function removeFromDom(el) {

    el.parentNode.removeChild(el);
}