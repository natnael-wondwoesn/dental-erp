UPDATE `Hospital`
SET
  `name` = 'D/R Lemlem Special Dental Clinic',
  `phone` = '0911-529475',
  `alternatePhone` = '0911-529480'
WHERE LOWER(`name`) IN (
  'sunny smile speciality clinic',
  'sunny smile speciality cinic',
  'dentix dental clinic',
  'dentix'
);
