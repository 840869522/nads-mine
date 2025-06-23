<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400"></a></p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

**The fllowing is some docs about laravel**

- [laravel中文文档 - 目录结构](https://docs.golaravel.com/docs/9.x/structure)
- [laravel中文文档 - 路由文件](https://docs.golaravel.com/docs/9.x/routing)
- [laravel中文文档 - 中间件](https://docs.golaravel.com/docs/9.x/middleware)
- [laravel中文文档 - 控制器](https://docs.golaravel.com/docs/9.x/controllers)
- [laravel中文文档 - 请求数据](https://docs.golaravel.com/docs/9.x/requests)
- [laravel中文文档 - 执行原生SQL](https://docs.golaravel.com/docs/9.x/database#running-queries)

## About version

- php >= 8.0

- laravel = 9.0

- other detail will show in `composer.json` or `composer.lock`


## About how to edit

- use  the fllowing command create controller file 
```bash 
php artisan make:controller <driectory_name>/<controller_file_name>
```
- edit this file <controller_dile_name>
- if need use model file, create model file and 
```php
use <model_file_namespace>\<model_file_name>;
```
- edit `routes/api.php` or `routes/web.php`

## About how to run

1. composer install
2. composer dump_autoload
3. php artisan serve

