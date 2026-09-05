Drop bundled binaries here per service:

  apache/      -> bin/httpd.exe + conf/httpd.conf  (Apache 2.4.x)
  nginx/       -> nginx.exe + conf/nginx.conf      (Nginx 1.26.x stable)
  php/         -> <version>/php-cgi.exe + php.ini  (PHP 8.3.x; multi-version subfolders)
  mysql/       -> bin/mysqld.exe + my.cnf          (MySQL Community 8.4 LTS)
  mariadb/     -> bin/mariadbd.exe + my.cnf        (MariaDB 11.4 LTS)
  postgresql/  -> bin/postgres.exe + postgresql.conf (PostgreSQL 17.x)

Without binaries the app runs services in mock mode so the dashboard stays testable.
Record exact versions in README.md before release.
