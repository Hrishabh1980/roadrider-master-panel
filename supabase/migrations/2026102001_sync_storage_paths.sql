-- Sync store_photos storage_path with actual uploaded filenames in store-photos bucket
UPDATE public.store_photos
SET storage_path = '35eab300-3793-4e26-8109-82bfade2c9f1/storefront_1792409374120_Screenshot_2026-10-16_at_2.20.55_PM.png'
WHERE store_id = '35eab300-3793-4e26-8109-82bfade2c9f1' AND photo_type = 'storefront';

UPDATE public.store_photos
SET storage_path = '35eab300-3793-4e26-8109-82bfade2c9f1/logo_1792409374959_Screenshot_2026-10-16_at_2.20.55_PM.png'
WHERE store_id = '35eab300-3793-4e26-8109-82bfade2c9f1' AND photo_type = 'logo';

UPDATE public.store_photos
SET storage_path = 'c4b3561e-32ba-4ef2-9d06-0afb5fd44679/storefront_1792323482578_NL.jpeg'
WHERE store_id = 'c4b3561e-32ba-4ef2-9d06-0afb5fd44679' AND photo_type = 'storefront';

UPDATE public.store_photos
SET storage_path = 'c4b3561e-32ba-4ef2-9d06-0afb5fd44679/logo_1792323482985_NL.jpeg'
WHERE store_id = 'c4b3561e-32ba-4ef2-9d06-0afb5fd44679' AND photo_type = 'logo';

-- Also link the uploaded product image to product in jawan kisan
UPDATE public.products
SET image_url = '35eab300-3793-4e26-8109-82bfade2c9f1/product_1792420099146_fe1o7.png'
WHERE store_id = '35eab300-3793-4e26-8109-82bfade2c9f1' AND name = 'Paneer Lababdar';
