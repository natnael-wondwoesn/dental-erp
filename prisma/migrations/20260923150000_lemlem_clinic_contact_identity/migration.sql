UPDATE `Hospital`
SET
  `name` = 'D/R Lemlem Special Dental Clinic',
  `email` = 'hello@lemlemdental.et',
  `phone` = '0911-529475',
  `alternatePhone` = '0911-529480',
  `website` = 'www.lemlemdental.et',
  `upiId` = 'lemlemdental@telebirr'
WHERE `slug` = 'demo-dental-clinic'
   OR LOWER(`name`) IN (
     'sunny smile speciality clinic',
     'sunny smile speciality cinic',
     'd/r lemlem special dental clinic'
   );

UPDATE `User`
SET `email` = REPLACE(LOWER(`email`), '@sunnysmile.et', '@lemlemdental.et')
WHERE LOWER(`email`) LIKE '%@sunnysmile.et';

UPDATE `Staff`
SET `email` = REPLACE(LOWER(`email`), '@sunnysmile.et', '@lemlemdental.et')
WHERE LOWER(`email`) LIKE '%@sunnysmile.et';
