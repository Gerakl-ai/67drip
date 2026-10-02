# 67 DRIP: интернет-магазин кастомной одежды

Учебный проект по дисциплине «Backend» (задание 3: вёрстка). Адаптивный сайт на HTML5, CSS3 и чистом JavaScript без библиотек.

**Сайт:** https://gerakl-ai.github.io/67drip/

## Что внутри

- 12 страниц товаров, каталог категорий, листинг с фильтром по категориям, поиском и сортировкой по цене и названию.
- Корзина и оформление заказа (данные хранятся в localStorage), промокод `DRIP67` даёт скидку 10%.
- Формы обратной связи и заказа: поля text, email, tel, textarea, checkbox, проверка на JavaScript с понятными сообщениями об ошибках.
- Избранное, галерея товара, мобильное меню, CSS-переходы и анимации (`@keyframes`).
- Именование классов по BEM (`product-card__name`, `btn--primary`), все страницы проходят проверку W3C Nu HTML Checker без ошибок и предупреждений.

## Структура

```
index.html, catalog.html, listing.html, cart.html, checkout.html, contacts.html, delivery.html, styleguide.html
product.html, product-*.html   страницы товаров
css/style.css                  стили, токены дизайн-системы
js/main.js, js/products.js     логика и данные каталога
img/, fonts/                   изображения и шрифты Unbounded и Onest
```

## Примечания

Изображения товаров созданы нейросетью и служат иллюстрациями. Телефон, e-mail и адрес вымышленные.
