-- confirm row exists
SELECT * FROM public."Franchise";

-- delete safely inside a transaction
BEGIN;
DELETE FROM public."Franchise" WHERE "code" = 'SINCHAN0196';
COMMIT;