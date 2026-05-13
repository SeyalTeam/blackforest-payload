import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('superadmin', 'admin', 'delivery', 'branch', 'company', 'factory', 'kitchen', 'chef', 'cashier', 'waiter', 'supervisor', 'driver');
  CREATE TYPE "public"."enum_products_branch_overrides_unit" AS ENUM('pcs', 'kg', 'g');
  CREATE TYPE "public"."enum_products_branch_overrides_gst" AS ENUM('0', '5', '12', '18', '22');
  CREATE TYPE "public"."enum_products_default_price_details_unit" AS ENUM('pcs', 'kg', 'g');
  CREATE TYPE "public"."enum_products_default_price_details_gst" AS ENUM('0', '5', '12', '18', '22');
  CREATE TYPE "public"."enum_dealers_status" AS ENUM('active', 'inactive', 'on-hold');
  CREATE TYPE "public"."enum_dealers_preferred_payment_method" AS ENUM('cash', 'upi', 'cheque', 'credit');
  CREATE TYPE "public"."enum_employees_status" AS ENUM('active', 'inactive');
  CREATE TYPE "public"."enum_employees_team" AS ENUM('waiter', 'chef', 'driver', 'cashier', 'manager', 'supervisor', 'delivery', 'kitchen');
  CREATE TYPE "public"."enum_message_threads_status" AS ENUM('open', 'archived');
  CREATE TYPE "public"."enum_message_attachments_attachment_type" AS ENUM('image', 'video');
  CREATE TYPE "public"."enum_messages_recipient_audience" AS ENUM('admins', 'staff');
  CREATE TYPE "public"."enum_messages_message_type" AS ENUM('text', 'image', 'video');
  CREATE TYPE "public"."enum_message_receipts_recipient_audience" AS ENUM('admins', 'staff');
  CREATE TYPE "public"."enum_message_receipts_status" AS ENUM('sent', 'delivered', 'read');
  CREATE TYPE "public"."enum_billings_items_status" AS ENUM('ordered', 'prepared', 'confirmed', 'delivered', 'cancelled');
  CREATE TYPE "public"."enum_billings_payment_method" AS ENUM('cash', 'card', 'upi', 'other');
  CREATE TYPE "public"."enum_billings_status" AS ENUM('ordered', 'prepared', 'confirmed', 'delivered', 'completed', 'settled', 'cancelled');
  CREATE TYPE "public"."enum_return_orders_status" AS ENUM('pending', 'accepted', 'returned', 'cancelled');
  CREATE TYPE "public"."enum_expenses_details_source" AS ENUM('MAINTENANCE', 'TRANSPORT', 'FUEL', 'PACKING', 'STAFF WELFARE', 'Supplies', 'ADVERTISEMENT', 'ADVANCE', 'COMPLEMENTARY', 'RAW MATERIAL', 'SALARY', 'OC PRODUCTS', 'OTHERS');
  CREATE TYPE "public"."enum_stock_orders_items_status" AS ENUM('ordered', 'sending', 'confirmed', 'picked', 'received');
  CREATE TYPE "public"."enum_stock_orders_status" AS ENUM('ordered', 'sending', 'confirmed', 'picked', 'received');
  CREATE TYPE "public"."enum_reviews_items_status" AS ENUM('waiting', 'replied', 'approved');
  CREATE TYPE "public"."enum_instock_entries_items_status" AS ENUM('waiting', 'approved');
  CREATE TYPE "public"."enum_instock_entries_status" AS ENUM('waiting', 'approved');
  CREATE TYPE "public"."enum_attendance_activities_type" AS ENUM('session', 'break');
  CREATE TYPE "public"."enum_attendance_activities_status" AS ENUM('active', 'closed');
  CREATE TYPE "public"."enum_attendance_status" AS ENUM('active', 'closed');
  CREATE TYPE "public"."enum_attendance_type" AS ENUM('in', 'out');
  CREATE TYPE "public"."enum_stock_alerts_status" AS ENUM('open', 'acknowledged');
  CREATE TYPE "public"."enum_idempotency_keys_status" AS ENUM('processing', 'completed', 'failed');
  CREATE TYPE "public"."enum_ip_settings_role_restrictions_ip_ranges_ip_type" AS ENUM('public', 'private');
  CREATE TYPE "public"."enum_ip_settings_role_restrictions_role" AS ENUM('chef', 'driver', 'supervisor', 'waiter', 'cashier', 'delivery', 'branch', 'kitchen');
  CREATE TYPE "public"."enum_widget_settings_table_q_r_domains_type" AS ENUM('primary', 'secondary');
  CREATE TYPE "public"."enum_widget_settings_app_a_p_i_domains_domains_type" AS ENUM('primary', 'secondary');
  CREATE TYPE "public"."enum_widget_settings_app_a_p_i_domains_app_key" AS ENUM('billing-app');
  CREATE TYPE "public"."enum_random_offers_daily_start_time" AS ENUM('00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45', '03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45', '06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45');
  CREATE TYPE "public"."enum_random_offers_daily_end_time" AS ENUM('00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45', '03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45', '06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45');
  CREATE TYPE "public"."tp_start" AS ENUM('00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45', '03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45', '06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45');
  CREATE TYPE "public"."tp_end" AS ENUM('00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45', '03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45', '06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45');
  CREATE TYPE "public"."cep_start" AS ENUM('00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45', '03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45', '06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45');
  CREATE TYPE "public"."cep_end" AS ENUM('00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00', '02:15', '02:30', '02:45', '03:00', '03:15', '03:30', '03:45', '04:00', '04:15', '04:30', '04:45', '05:00', '05:15', '05:30', '05:45', '06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45', '17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00', '21:15', '21:30', '21:45', '22:00', '22:15', '22:30', '22:45', '23:00', '23:15', '23:30', '23:45');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" "enum_users_role" DEFAULT 'admin' NOT NULL,
  	"is_kitchen" boolean DEFAULT false,
  	"is_stock" boolean DEFAULT false,
  	"branch_id" integer,
  	"last_login_branch_id" integer,
  	"company_id" integer,
  	"employee_id" integer,
  	"device_id" varchar,
  	"force_logout_all_devices" boolean DEFAULT false,
  	"login_blocked" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"branches_id" integer,
  	"kitchens_id" integer,
  	"categories_id" integer,
  	"companies_id" integer
  );
  
  CREATE TABLE "companies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"hq_address" varchar,
  	"gst" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "branches_product_resets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"reset_date" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "branches" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"company_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"address" varchar NOT NULL,
  	"gst" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"branch_pin" varchar NOT NULL,
  	"ip_address" varchar,
  	"printer_ip" varchar,
  	"inventory_reset_date" timestamp(3) with time zone,
  	"stock_order_workflow_skip_supervisor" boolean DEFAULT false,
  	"stock_order_workflow_skip_driver" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "departments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "departments_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"companies_id" integer
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"image_id" integer,
  	"is_billing" boolean DEFAULT false,
  	"is_cake" boolean DEFAULT false,
  	"is_stock" boolean DEFAULT false,
  	"is_kitchen" boolean DEFAULT false,
  	"department_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"companies_id" integer
  );
  
  CREATE TABLE "products_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "products_branch_overrides" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"branch_id" integer NOT NULL,
  	"price" numeric,
  	"rate" numeric,
  	"offer" numeric,
  	"quantity" numeric,
  	"unit" "enum_products_branch_overrides_unit",
  	"gst" "enum_products_branch_overrides_gst" DEFAULT '0'
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"category_id" integer NOT NULL,
  	"dealer_id" integer,
  	"expiry_days" numeric,
  	"preparation_time" numeric,
  	"hsn_code" varchar,
  	"product_id" varchar,
  	"upc" varchar,
  	"is_veg" boolean DEFAULT false,
  	"is_available" boolean DEFAULT true,
  	"is_stock" boolean DEFAULT true,
  	"is_out_of_stock" boolean DEFAULT false,
  	"default_price_details_enable_a_c" boolean DEFAULT false,
  	"default_price_details_enable_non_a_c" boolean DEFAULT false,
  	"default_price_details_price" numeric NOT NULL,
  	"default_price_details_ac_price" numeric,
  	"default_price_details_non_a_c_price" numeric,
  	"default_price_details_rate" numeric NOT NULL,
  	"default_price_details_offer" numeric,
  	"default_price_details_quantity" numeric NOT NULL,
  	"default_price_details_unit" "enum_products_default_price_details_unit" NOT NULL,
  	"default_price_details_gst" "enum_products_default_price_details_gst" DEFAULT '0' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"branches_id" integer
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"prefix" varchar DEFAULT 'blackforest/uploads',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar
  );
  
  CREATE TABLE "dealers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"company_name" varchar NOT NULL,
  	"address" varchar NOT NULL,
  	"phone_number" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"is_g_s_t_registered" boolean DEFAULT true,
  	"gst" varchar,
  	"pan" varchar,
  	"fssai" varchar,
  	"contact_person_name" varchar NOT NULL,
  	"contact_person_designation" varchar,
  	"contact_person_phone" varchar,
  	"contact_person_email" varchar,
  	"notes" varchar,
  	"status" "enum_dealers_status" DEFAULT 'active' NOT NULL,
  	"has_bank_account" boolean DEFAULT true,
  	"preferred_payment_method" "enum_dealers_preferred_payment_method" DEFAULT 'cash',
  	"bank_details_bank_name" varchar,
  	"bank_details_account_number" varchar,
  	"bank_details_ifsc_code" varchar,
  	"bank_details_branch" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "dealers_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"companies_id" integer,
  	"branches_id" integer
  );
  
  CREATE TABLE "employees" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"employee_id" varchar NOT NULL,
  	"phone_number" varchar NOT NULL,
  	"email" varchar,
  	"address" varchar,
  	"status" "enum_employees_status" DEFAULT 'active' NOT NULL,
  	"team" "enum_employees_team" NOT NULL,
  	"aadhaar_photo_id" integer,
  	"photo_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "message_threads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"participant_name" varchar NOT NULL,
  	"staff_user_id" integer NOT NULL,
  	"employee_id" integer NOT NULL,
  	"status" "enum_message_threads_status" DEFAULT 'open' NOT NULL,
  	"last_message_at" timestamp(3) with time zone,
  	"last_message_text" varchar,
  	"last_message_by_user_id" integer,
  	"last_message_by_role" varchar,
  	"admin_last_read_at" timestamp(3) with time zone,
  	"staff_last_read_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "message_attachments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"thread_id" integer NOT NULL,
  	"staff_user_id" integer NOT NULL,
  	"employee_id" integer NOT NULL,
  	"uploaded_by_id" integer NOT NULL,
  	"attachment_type" "enum_message_attachments_attachment_type" NOT NULL,
  	"alt" varchar,
  	"prefix" varchar DEFAULT 'blackforest/uploads/messages',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"thread_id" integer NOT NULL,
  	"staff_user_id" integer NOT NULL,
  	"employee_id" integer NOT NULL,
  	"seq" numeric NOT NULL,
  	"sender_user_id" integer NOT NULL,
  	"sender_role" varchar NOT NULL,
  	"recipient_audience" "enum_messages_recipient_audience" NOT NULL,
  	"message_type" "enum_messages_message_type" NOT NULL,
  	"attachment_id" integer,
  	"text" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "message_receipts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"message_id" integer NOT NULL,
  	"thread_id" integer NOT NULL,
  	"staff_user_id" integer NOT NULL,
  	"employee_id" integer NOT NULL,
  	"recipient_audience" "enum_message_receipts_recipient_audience" NOT NULL,
  	"recipient_user_id" integer,
  	"status" "enum_message_receipts_status" DEFAULT 'sent' NOT NULL,
  	"sent_at" timestamp(3) with time zone NOT NULL,
  	"delivered_at" timestamp(3) with time zone,
  	"read_at" timestamp(3) with time zone,
  	"delivered_by_user_id" integer,
  	"read_by_user_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "billings_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"status" "enum_billings_items_status" DEFAULT 'ordered',
  	"name" varchar NOT NULL,
  	"notes" varchar,
  	"quantity" numeric NOT NULL,
  	"unit_price" numeric NOT NULL,
  	"subtotal" numeric NOT NULL,
  	"gst_rate" numeric,
  	"taxable_amount" numeric,
  	"gst_amount" numeric,
  	"cgst_amount" numeric,
  	"sgst_amount" numeric,
  	"final_line_total" numeric,
  	"is_offer_free_item" boolean DEFAULT false,
  	"offer_rule_key" varchar,
  	"offer_trigger_product_id" integer,
  	"is_price_offer_applied" boolean DEFAULT false,
  	"price_offer_rule_key" varchar,
  	"price_offer_discount_per_unit" numeric DEFAULT 0,
  	"price_offer_applied_units" numeric DEFAULT 0,
  	"effective_unit_price" numeric,
  	"is_random_customer_offer_item" boolean DEFAULT false,
  	"is_amount_based_free_offer_item" boolean DEFAULT false,
  	"amount_based_free_offer_rule_key" varchar,
  	"random_customer_offer_campaign_code" varchar,
  	"ordered_at" varchar,
  	"confirmed_at" varchar,
  	"preparing_time" numeric,
  	"prepared_at" varchar,
  	"prepared_by_id" integer,
  	"confirmed_by_id" integer,
  	"delivered_at" varchar,
  	"delivered_by_id" integer,
  	"cancelled_at" varchar,
  	"branch_override" boolean
  );
  
  CREATE TABLE "billings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"invoice_number" varchar NOT NULL,
  	"kot_number" varchar,
  	"gross_amount" numeric,
  	"total_amount" numeric NOT NULL,
  	"sub_total" numeric,
  	"cgst_amount" numeric,
  	"sgst_amount" numeric,
  	"total_amount_before_round_off" numeric,
  	"round_off_amount" numeric,
  	"total_taxable_amount" numeric,
  	"total_g_s_t_amount" numeric,
  	"branch_id" integer NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"payment_method" "enum_billings_payment_method",
  	"apply_customer_offer" boolean DEFAULT false,
  	"company_id" integer NOT NULL,
  	"customer_details_name" varchar,
  	"customer_details_phone_number" varchar,
  	"customer_details_address" varchar,
  	"status" "enum_billings_status" DEFAULT 'ordered',
  	"customer_offer_applied" boolean DEFAULT false,
  	"customer_offer_discount" numeric DEFAULT 0,
  	"customer_entry_percentage_offer_applied" boolean DEFAULT false,
  	"customer_entry_percentage_offer_discount" numeric DEFAULT 0,
  	"total_percentage_offer_applied" boolean DEFAULT false,
  	"total_percentage_offer_discount" numeric DEFAULT 0,
  	"customer_reward_points_earned" numeric DEFAULT 0,
  	"customer_reward_processed" boolean DEFAULT false,
  	"offer_counters_processed" boolean DEFAULT false,
  	"notes" varchar,
  	"table_details_section" varchar,
  	"table_details_table_number" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "return_orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"quantity" numeric NOT NULL,
  	"unit_price" numeric NOT NULL,
  	"subtotal" numeric NOT NULL,
  	"proof_photo_id" integer
  );
  
  CREATE TABLE "return_orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"return_number" varchar NOT NULL,
  	"total_amount" numeric NOT NULL,
  	"branch_id" integer NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"company_id" integer NOT NULL,
  	"status" "enum_return_orders_status" DEFAULT 'pending',
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "closing_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"closing_number" varchar NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"system_sales" numeric NOT NULL,
  	"total_bills" numeric DEFAULT 0,
  	"manual_sales" numeric NOT NULL,
  	"online_sales" numeric NOT NULL,
  	"expenses" numeric NOT NULL,
  	"return_total" numeric NOT NULL,
  	"stock_orders" numeric DEFAULT 0,
  	"credit_card" numeric NOT NULL,
  	"upi" numeric NOT NULL,
  	"cash" numeric NOT NULL,
  	"denominations_count2000" numeric DEFAULT 0,
  	"denominations_count500" numeric DEFAULT 0,
  	"denominations_count200" numeric DEFAULT 0,
  	"denominations_count100" numeric DEFAULT 0,
  	"denominations_count50" numeric DEFAULT 0,
  	"denominations_count10" numeric DEFAULT 0,
  	"denominations_count5" numeric DEFAULT 0,
  	"total_sales" numeric,
  	"total_payments" numeric,
  	"net" numeric,
  	"branch_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "expenses_details" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"source" "enum_expenses_details_source" NOT NULL,
  	"reason" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "expenses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"invoice_number" varchar,
  	"branch_id" integer NOT NULL,
  	"total" numeric NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "stock_orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"in_stock" numeric NOT NULL,
  	"in_stock_amount" numeric,
  	"required_qty" numeric NOT NULL,
  	"required_amount" numeric,
  	"required_date" timestamp(3) with time zone,
  	"sending_qty" numeric,
  	"sending_amount" numeric,
  	"sending_date" timestamp(3) with time zone,
  	"sending_updated_by_id" integer,
  	"confirmed_qty" numeric,
  	"confirmed_amount" numeric,
  	"confirmed_date" timestamp(3) with time zone,
  	"confirmed_updated_by_id" integer,
  	"picked_qty" numeric,
  	"picked_amount" numeric,
  	"picked_date" timestamp(3) with time zone,
  	"picked_updated_by_id" integer,
  	"received_qty" numeric,
  	"received_amount" numeric,
  	"received_date" timestamp(3) with time zone,
  	"difference_qty" numeric,
  	"difference_amount" numeric,
  	"status" "enum_stock_orders_items_status" DEFAULT 'ordered'
  );
  
  CREATE TABLE "stock_orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"invoice_number" varchar NOT NULL,
  	"delivery_date" timestamp(3) with time zone NOT NULL,
  	"branch_id" integer NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"company_id" integer NOT NULL,
  	"status" "enum_stock_orders_status" DEFAULT 'ordered',
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reviews_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"rating" numeric,
  	"feedback" varchar NOT NULL,
  	"chef_reply" varchar,
  	"replied_by" varchar,
  	"replied_at" timestamp(3) with time zone,
  	"status" "enum_reviews_items_status" DEFAULT 'waiting'
  );
  
  CREATE TABLE "reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"bill_id" integer NOT NULL,
  	"customer_name" varchar,
  	"customer_phone" varchar,
  	"branch_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"phone_number" varchar NOT NULL,
  	"reward_points" numeric DEFAULT 0,
  	"reward_progress_amount" numeric DEFAULT 0,
  	"is_offer_eligible" boolean DEFAULT false,
  	"total_offers_redeemed" numeric DEFAULT 0,
  	"random_customer_offer_assigned" boolean DEFAULT false,
  	"random_customer_offer_redeemed" boolean DEFAULT false,
  	"random_customer_offer_product_id" integer,
  	"random_customer_offer_campaign_code" varchar,
  	"random_customer_offer_assigned_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "customers_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"billings_id" integer
  );
  
  CREATE TABLE "billing_customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"phone_number" varchar NOT NULL,
  	"last_bill_id" integer,
  	"last_synced_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "instock_entries_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"dealer_id" integer,
  	"instock" numeric NOT NULL,
  	"status" "enum_instock_entries_items_status" DEFAULT 'waiting'
  );
  
  CREATE TABLE "instock_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"invoice_number" varchar NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"branch_id" integer NOT NULL,
  	"created_by_id" integer NOT NULL,
  	"company_id" integer NOT NULL,
  	"status" "enum_instock_entries_status" DEFAULT 'waiting',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tables_sections_range_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"table_range" varchar NOT NULL
  );
  
  CREATE TABLE "tables_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"table_count" numeric,
  	"table_range" varchar
  );
  
  CREATE TABLE "tables" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"branch_id" integer NOT NULL,
  	"table_layout_summary" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "kitchens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "kitchens_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"departments_id" integer,
  	"branches_id" integer,
  	"categories_id" integer
  );
  
  CREATE TABLE "attendance_activities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_attendance_activities_type" NOT NULL,
  	"punch_in" timestamp(3) with time zone NOT NULL,
  	"punch_out" timestamp(3) with time zone,
  	"status" "enum_attendance_activities_status" DEFAULT 'active',
  	"duration_seconds" numeric,
  	"ip_address" varchar,
  	"device" varchar,
  	"latitude" numeric,
  	"longitude" numeric
  );
  
  CREATE TABLE "attendance" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"date_string" varchar NOT NULL,
  	"punch_in" timestamp(3) with time zone,
  	"punch_out" timestamp(3) with time zone,
  	"status" "enum_attendance_status",
  	"type" "enum_attendance_type",
  	"timestamp" timestamp(3) with time zone,
  	"ip_address" varchar,
  	"device" varchar,
  	"location_latitude" numeric,
  	"location_longitude" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "apk_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"prefix" varchar DEFAULT 'blackforest/uploads/apk',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "stock_alerts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"branch_id" integer NOT NULL,
  	"branch_name" varchar,
  	"product_id" integer NOT NULL,
  	"product_name" varchar,
  	"requested_by_id" integer NOT NULL,
  	"requested_by_name" varchar,
  	"requested_by_role" varchar,
  	"status" "enum_stock_alerts_status" DEFAULT 'open' NOT NULL,
  	"acknowledged_at" timestamp(3) with time zone,
  	"acknowledged_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "idempotency_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"scope" varchar NOT NULL,
  	"request_hash" varchar NOT NULL,
  	"status" "enum_idempotency_keys_status" DEFAULT 'processing' NOT NULL,
  	"request_method" varchar,
  	"request_path" varchar,
  	"request_id" varchar,
  	"user_id" varchar,
  	"response_status" numeric,
  	"response_payload" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"companies_id" integer,
  	"branches_id" integer,
  	"departments_id" integer,
  	"categories_id" integer,
  	"products_id" integer,
  	"media_id" integer,
  	"dealers_id" integer,
  	"employees_id" integer,
  	"message_threads_id" integer,
  	"message_attachments_id" integer,
  	"messages_id" integer,
  	"message_receipts_id" integer,
  	"billings_id" integer,
  	"return_orders_id" integer,
  	"closing_entries_id" integer,
  	"expenses_id" integer,
  	"stock_orders_id" integer,
  	"reviews_id" integer,
  	"customers_id" integer,
  	"billing_customers_id" integer,
  	"instock_entries_id" integer,
  	"tables_id" integer,
  	"kitchens_id" integer,
  	"attendance_id" integer,
  	"apk_files_id" integer,
  	"stock_alerts_id" integer,
  	"idempotency_keys_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ip_settings_role_restrictions_ip_ranges" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"ip_type" "enum_ip_settings_role_restrictions_ip_ranges_ip_type" DEFAULT 'public' NOT NULL,
  	"ip_or_range" varchar NOT NULL
  );
  
  CREATE TABLE "ip_settings_role_restrictions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"role" "enum_ip_settings_role_restrictions_role" NOT NULL
  );
  
  CREATE TABLE "ip_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "general_dashboard" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "branch_billing_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "category_wise_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "product_wise_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "product_time_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "chef_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "closing_entry_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "waiter_wise_billing_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "inventory_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "stock_order_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "afterstock_customer_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "review_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "instock_entry_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "expense_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "return_order_report" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "branch_geo_settings_locations_kot_printers" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"printer_ip" varchar NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "branch_geo_settings_locations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"branch_id" integer NOT NULL,
  	"latitude" numeric NOT NULL,
  	"longitude" numeric NOT NULL,
  	"radius" numeric DEFAULT 100 NOT NULL,
  	"ip_address" varchar,
  	"printer_ip" varchar
  );
  
  CREATE TABLE "branch_geo_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "branch_geo_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"kitchens_id" integer
  );
  
  CREATE TABLE "network_status" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "widget_settings_table_order_customer_details_by_branch" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"branch_id" integer NOT NULL,
  	"show_customer_details_for_table_orders" boolean DEFAULT true,
  	"allow_skip_customer_details_for_table_orders" boolean DEFAULT true,
  	"show_customer_history_for_table_orders" boolean DEFAULT true,
  	"auto_submit_customer_details_for_table_orders" boolean DEFAULT true
  );
  
  CREATE TABLE "widget_settings_billing_order_customer_details_by_branch" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"branch_id" integer NOT NULL,
  	"show_customer_details_for_billing_orders" boolean DEFAULT true,
  	"allow_skip_customer_details_for_billing_orders" boolean DEFAULT true,
  	"show_customer_history_for_billing_orders" boolean DEFAULT true,
  	"auto_submit_customer_details_for_billing_orders" boolean DEFAULT true
  );
  
  CREATE TABLE "widget_settings_favorite_products_by_branch_rules" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"rule_name" varchar
  );
  
  CREATE TABLE "widget_settings_favorite_categories_by_branch_rules" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"rule_name" varchar
  );
  
  CREATE TABLE "widget_settings_table_q_r_domains" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"domain_u_r_l" varchar NOT NULL,
  	"type" "enum_widget_settings_table_q_r_domains_type" DEFAULT 'primary',
  	"enabled" boolean DEFAULT true
  );
  
  CREATE TABLE "widget_settings_app_a_p_i_domains_domains" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"domain_u_r_l" varchar NOT NULL,
  	"type" "enum_widget_settings_app_a_p_i_domains_domains_type" DEFAULT 'primary',
  	"enabled" boolean DEFAULT true
  );
  
  CREATE TABLE "widget_settings_app_a_p_i_domains" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"app_key" "enum_widget_settings_app_a_p_i_domains_app_key" NOT NULL
  );
  
  CREATE TABLE "widget_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "widget_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"branches_id" integer,
  	"categories_id" integer,
  	"products_id" integer
  );
  
  CREATE TABLE "p2p_usage" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"customer_id" integer,
  	"usage_count" numeric DEFAULT 0
  );
  
  CREATE TABLE "p2p_offers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"allow_on_billings" boolean DEFAULT true,
  	"allow_on_table_orders" boolean DEFAULT true,
  	"buy_product_id" integer,
  	"buy_quantity" numeric DEFAULT 1,
  	"free_product_id" integer,
  	"free_quantity" numeric DEFAULT 1,
  	"max_offer_count" numeric DEFAULT 0,
  	"max_customer_count" numeric DEFAULT 0,
  	"max_usage_per_customer" numeric DEFAULT 0,
  	"offer_given_count" numeric DEFAULT 0,
  	"offer_customer_count" numeric DEFAULT 0
  );
  
  CREATE TABLE "price_usage" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"customer_id" integer,
  	"usage_count" numeric DEFAULT 0
  );
  
  CREATE TABLE "price_offers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"allow_on_billings" boolean DEFAULT true,
  	"allow_on_table_orders" boolean DEFAULT true,
  	"product_id" integer,
  	"product_current_price" numeric,
  	"discount_amount" numeric DEFAULT 1,
  	"final_price_preview" numeric,
  	"max_offer_count" numeric DEFAULT 0,
  	"max_customer_count" numeric DEFAULT 0,
  	"max_usage_per_customer" numeric DEFAULT 0,
  	"offer_given_count" numeric DEFAULT 0,
  	"offer_customer_count" numeric DEFAULT 0
  );
  
  CREATE TABLE "random_usage" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"customer_id" integer,
  	"usage_count" numeric DEFAULT 0
  );
  
  CREATE TABLE "random_offers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"allow_on_billings" boolean DEFAULT true,
  	"allow_on_table_orders" boolean DEFAULT true,
  	"product_id" integer,
  	"winner_count" numeric DEFAULT 1,
  	"random_selection_chance_percent" numeric DEFAULT 50,
  	"max_usage_per_customer" numeric DEFAULT 1,
  	"available_from_date" timestamp(3) with time zone,
  	"available_to_date" timestamp(3) with time zone,
  	"daily_start_time" "enum_random_offers_daily_start_time",
  	"daily_end_time" "enum_random_offers_daily_end_time",
  	"assigned_count" numeric DEFAULT 0,
  	"redeemed_count" numeric DEFAULT 0
  );
  
  CREATE TABLE "tp_usage" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"customer_id" integer,
  	"usage_count" numeric DEFAULT 0
  );
  
  CREATE TABLE "cep_usage" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"customer_id" integer,
  	"usage_count" numeric DEFAULT 0
  );
  
  CREATE TABLE "amount_usage" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"customer_id" integer,
  	"usage_count" numeric DEFAULT 0
  );
  
  CREATE TABLE "amount_offers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"allow_on_billings" boolean DEFAULT true,
  	"allow_on_table_orders" boolean DEFAULT true,
  	"minimum_bill_amount" numeric DEFAULT 1000,
  	"free_quantity" numeric DEFAULT 1,
  	"free_product_id" integer,
  	"max_offer_count" numeric DEFAULT 0,
  	"max_customer_count" numeric DEFAULT 0,
  	"max_usage_per_customer" numeric DEFAULT 0,
  	"offer_given_count" numeric DEFAULT 0,
  	"offer_customer_count" numeric DEFAULT 0
  );
  
  CREATE TABLE "customer_offer_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"allow_customer_credit_offer_on_billings" boolean DEFAULT true,
  	"allow_customer_credit_offer_on_table_orders" boolean DEFAULT true,
  	"spend_amount_per_step" numeric DEFAULT 1000 NOT NULL,
  	"points_per_step" numeric DEFAULT 10 NOT NULL,
  	"points_needed_for_offer" numeric DEFAULT 50 NOT NULL,
  	"offer_amount" numeric DEFAULT 50 NOT NULL,
  	"reset_on_redeem" boolean DEFAULT true,
  	"enable_product_to_product_offer" boolean DEFAULT false,
  	"allow_product_to_product_offer_on_billings" boolean DEFAULT true,
  	"allow_product_to_product_offer_on_table_orders" boolean DEFAULT true,
  	"enable_product_price_offer" boolean DEFAULT false,
  	"allow_product_price_offer_on_billings" boolean DEFAULT true,
  	"allow_product_price_offer_on_table_orders" boolean DEFAULT true,
  	"enable_random_customer_product_offer" boolean DEFAULT false,
  	"allow_random_customer_product_offer_on_billings" boolean DEFAULT true,
  	"allow_random_customer_product_offer_on_table_orders" boolean DEFAULT true,
  	"random_customer_offer_campaign_code" varchar DEFAULT 'campaign-1' NOT NULL,
  	"random_customer_offer_timezone" varchar DEFAULT 'Asia/Kolkata' NOT NULL,
  	"reselect_random_customer_offer" boolean DEFAULT false,
  	"random_customer_offer_assigned_count" numeric DEFAULT 0,
  	"random_customer_offer_redeemed_count" numeric DEFAULT 0,
  	"random_customer_offer_last_assigned_at" timestamp(3) with time zone,
  	"enable_total_percentage_offer" boolean DEFAULT false,
  	"allow_total_percentage_offer_on_billings" boolean DEFAULT true,
  	"allow_total_percentage_offer_on_table_orders" boolean DEFAULT true,
  	"total_percentage_offer_percent" numeric DEFAULT 5 NOT NULL,
  	"total_percentage_offer_random_selection_chance_percent" numeric DEFAULT 50,
  	"total_percentage_offer_max_offer_count" numeric DEFAULT 0,
  	"total_percentage_offer_max_customer_count" numeric DEFAULT 0,
  	"total_percentage_offer_max_usage_per_customer" numeric DEFAULT 0,
  	"total_percentage_offer_available_from_date" timestamp(3) with time zone,
  	"total_percentage_offer_available_to_date" timestamp(3) with time zone,
  	"total_percentage_offer_daily_start_time" "tp_start",
  	"total_percentage_offer_daily_end_time" "tp_end",
  	"total_percentage_offer_given_count" numeric DEFAULT 0,
  	"total_percentage_offer_customer_count" numeric DEFAULT 0,
  	"enable_customer_entry_percentage_offer" boolean DEFAULT false,
  	"allow_customer_entry_percentage_offer_on_billings" boolean DEFAULT true,
  	"allow_customer_entry_percentage_offer_on_table_orders" boolean DEFAULT true,
  	"customer_entry_percentage_offer_percent" numeric DEFAULT 5 NOT NULL,
  	"customer_entry_percentage_offer_timezone" varchar DEFAULT 'Asia/Kolkata' NOT NULL,
  	"customer_entry_percentage_offer_available_from_date" timestamp(3) with time zone,
  	"customer_entry_percentage_offer_available_to_date" timestamp(3) with time zone,
  	"customer_entry_percentage_offer_daily_start_time" "cep_start",
  	"customer_entry_percentage_offer_daily_end_time" "cep_end",
  	"customer_entry_percentage_offer_given_count" numeric DEFAULT 0,
  	"customer_entry_percentage_offer_customer_count" numeric DEFAULT 0,
  	"enable_amount_based_free_product_offer" boolean DEFAULT false,
  	"allow_amount_based_free_product_offer_on_billings" boolean DEFAULT true,
  	"allow_amount_based_free_product_offer_on_table_orders" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "customer_offer_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"branches_id" integer,
  	"customers_id" integer
  );
  
  CREATE TABLE "app_download_settings_apps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"app_name" varchar NOT NULL,
  	"apk_file_id" integer,
  	"download_u_r_l" varchar NOT NULL,
  	"app_key" varchar NOT NULL
  );
  
  CREATE TABLE "app_download_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_last_login_branch_id_branches_id_fk" FOREIGN KEY ("last_login_branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_branches_fk" FOREIGN KEY ("branches_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_kitchens_fk" FOREIGN KEY ("kitchens_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_companies_fk" FOREIGN KEY ("companies_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "branches_product_resets" ADD CONSTRAINT "branches_product_resets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "branches_product_resets" ADD CONSTRAINT "branches_product_resets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "departments_rels" ADD CONSTRAINT "departments_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "departments_rels" ADD CONSTRAINT "departments_rels_companies_fk" FOREIGN KEY ("companies_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_rels" ADD CONSTRAINT "categories_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_rels" ADD CONSTRAINT "categories_rels_companies_fk" FOREIGN KEY ("companies_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_images" ADD CONSTRAINT "products_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_images" ADD CONSTRAINT "products_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_branch_overrides" ADD CONSTRAINT "products_branch_overrides_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_branch_overrides" ADD CONSTRAINT "products_branch_overrides_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_branches_fk" FOREIGN KEY ("branches_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "dealers_rels" ADD CONSTRAINT "dealers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "dealers_rels" ADD CONSTRAINT "dealers_rels_companies_fk" FOREIGN KEY ("companies_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "dealers_rels" ADD CONSTRAINT "dealers_rels_branches_fk" FOREIGN KEY ("branches_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "employees" ADD CONSTRAINT "employees_aadhaar_photo_id_media_id_fk" FOREIGN KEY ("aadhaar_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "employees" ADD CONSTRAINT "employees_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_last_message_by_user_id_users_id_fk" FOREIGN KEY ("last_message_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_attachment_id_message_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."message_attachments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_delivered_by_user_id_users_id_fk" FOREIGN KEY ("delivered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_read_by_user_id_users_id_fk" FOREIGN KEY ("read_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billings_items" ADD CONSTRAINT "billings_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billings_items" ADD CONSTRAINT "billings_items_offer_trigger_product_id_products_id_fk" FOREIGN KEY ("offer_trigger_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billings_items" ADD CONSTRAINT "billings_items_prepared_by_id_users_id_fk" FOREIGN KEY ("prepared_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billings_items" ADD CONSTRAINT "billings_items_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billings_items" ADD CONSTRAINT "billings_items_delivered_by_id_users_id_fk" FOREIGN KEY ("delivered_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billings_items" ADD CONSTRAINT "billings_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."billings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "billings" ADD CONSTRAINT "billings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billings" ADD CONSTRAINT "billings_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "billings" ADD CONSTRAINT "billings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "return_orders_items" ADD CONSTRAINT "return_orders_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "return_orders_items" ADD CONSTRAINT "return_orders_items_proof_photo_id_media_id_fk" FOREIGN KEY ("proof_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "return_orders_items" ADD CONSTRAINT "return_orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."return_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "return_orders" ADD CONSTRAINT "return_orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "return_orders" ADD CONSTRAINT "return_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "return_orders" ADD CONSTRAINT "return_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "closing_entries" ADD CONSTRAINT "closing_entries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expenses_details" ADD CONSTRAINT "expenses_details_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expenses_details" ADD CONSTRAINT "expenses_details_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_orders_items" ADD CONSTRAINT "stock_orders_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_orders_items" ADD CONSTRAINT "stock_orders_items_sending_updated_by_id_users_id_fk" FOREIGN KEY ("sending_updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_orders_items" ADD CONSTRAINT "stock_orders_items_confirmed_updated_by_id_users_id_fk" FOREIGN KEY ("confirmed_updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_orders_items" ADD CONSTRAINT "stock_orders_items_picked_updated_by_id_users_id_fk" FOREIGN KEY ("picked_updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_orders_items" ADD CONSTRAINT "stock_orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."stock_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "stock_orders" ADD CONSTRAINT "stock_orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_orders" ADD CONSTRAINT "stock_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_orders" ADD CONSTRAINT "stock_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews_items" ADD CONSTRAINT "reviews_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews_items" ADD CONSTRAINT "reviews_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bill_id_billings_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."billings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers" ADD CONSTRAINT "customers_random_customer_offer_product_id_products_id_fk" FOREIGN KEY ("random_customer_offer_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers_rels" ADD CONSTRAINT "customers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_rels" ADD CONSTRAINT "customers_rels_billings_fk" FOREIGN KEY ("billings_id") REFERENCES "public"."billings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_last_bill_id_billings_id_fk" FOREIGN KEY ("last_bill_id") REFERENCES "public"."billings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "instock_entries_items" ADD CONSTRAINT "instock_entries_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "instock_entries_items" ADD CONSTRAINT "instock_entries_items_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "instock_entries_items" ADD CONSTRAINT "instock_entries_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."instock_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "instock_entries" ADD CONSTRAINT "instock_entries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "instock_entries" ADD CONSTRAINT "instock_entries_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "instock_entries" ADD CONSTRAINT "instock_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tables_sections_range_rows" ADD CONSTRAINT "tables_sections_range_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tables_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tables_sections" ADD CONSTRAINT "tables_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tables" ADD CONSTRAINT "tables_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "kitchens_rels" ADD CONSTRAINT "kitchens_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "kitchens_rels" ADD CONSTRAINT "kitchens_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "kitchens_rels" ADD CONSTRAINT "kitchens_rels_branches_fk" FOREIGN KEY ("branches_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "kitchens_rels" ADD CONSTRAINT "kitchens_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "attendance_activities" ADD CONSTRAINT "attendance_activities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."attendance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_acknowledged_by_id_users_id_fk" FOREIGN KEY ("acknowledged_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_companies_fk" FOREIGN KEY ("companies_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_branches_fk" FOREIGN KEY ("branches_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_dealers_fk" FOREIGN KEY ("dealers_id") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_employees_fk" FOREIGN KEY ("employees_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_message_threads_fk" FOREIGN KEY ("message_threads_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_message_attachments_fk" FOREIGN KEY ("message_attachments_id") REFERENCES "public"."message_attachments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_messages_fk" FOREIGN KEY ("messages_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_message_receipts_fk" FOREIGN KEY ("message_receipts_id") REFERENCES "public"."message_receipts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_billings_fk" FOREIGN KEY ("billings_id") REFERENCES "public"."billings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_return_orders_fk" FOREIGN KEY ("return_orders_id") REFERENCES "public"."return_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_closing_entries_fk" FOREIGN KEY ("closing_entries_id") REFERENCES "public"."closing_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_expenses_fk" FOREIGN KEY ("expenses_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stock_orders_fk" FOREIGN KEY ("stock_orders_id") REFERENCES "public"."stock_orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_billing_customers_fk" FOREIGN KEY ("billing_customers_id") REFERENCES "public"."billing_customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_instock_entries_fk" FOREIGN KEY ("instock_entries_id") REFERENCES "public"."instock_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tables_fk" FOREIGN KEY ("tables_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_kitchens_fk" FOREIGN KEY ("kitchens_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_attendance_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_apk_files_fk" FOREIGN KEY ("apk_files_id") REFERENCES "public"."apk_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stock_alerts_fk" FOREIGN KEY ("stock_alerts_id") REFERENCES "public"."stock_alerts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_idempotency_keys_fk" FOREIGN KEY ("idempotency_keys_id") REFERENCES "public"."idempotency_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ip_settings_role_restrictions_ip_ranges" ADD CONSTRAINT "ip_settings_role_restrictions_ip_ranges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ip_settings_role_restrictions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ip_settings_role_restrictions" ADD CONSTRAINT "ip_settings_role_restrictions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ip_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "branch_geo_settings_locations_kot_printers" ADD CONSTRAINT "branch_geo_settings_locations_kot_printers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."branch_geo_settings_locations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "branch_geo_settings_locations" ADD CONSTRAINT "branch_geo_settings_locations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "branch_geo_settings_locations" ADD CONSTRAINT "branch_geo_settings_locations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."branch_geo_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "branch_geo_settings_rels" ADD CONSTRAINT "branch_geo_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."branch_geo_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "branch_geo_settings_rels" ADD CONSTRAINT "branch_geo_settings_rels_kitchens_fk" FOREIGN KEY ("kitchens_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "widget_settings_table_order_customer_details_by_branch" ADD CONSTRAINT "widget_settings_table_order_customer_details_by_branch_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "widget_settings_table_order_customer_details_by_branch" ADD CONSTRAINT "widget_settings_table_order_customer_details_by_branch_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."widget_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "widget_settings_billing_order_customer_details_by_branch" ADD CONSTRAINT "widget_settings_billing_order_customer_details_by_branch_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "widget_settings_billing_order_customer_details_by_branch" ADD CONSTRAINT "widget_settings_billing_order_customer_details_by_branch_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."widget_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "widget_settings_favorite_products_by_branch_rules" ADD CONSTRAINT "widget_settings_favorite_products_by_branch_rules_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."widget_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "widget_settings_favorite_categories_by_branch_rules" ADD CONSTRAINT "widget_settings_favorite_categories_by_branch_rules_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."widget_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "widget_settings_table_q_r_domains" ADD CONSTRAINT "widget_settings_table_q_r_domains_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."widget_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "widget_settings_app_a_p_i_domains_domains" ADD CONSTRAINT "widget_settings_app_a_p_i_domains_domains_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."widget_settings_app_a_p_i_domains"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "widget_settings_app_a_p_i_domains" ADD CONSTRAINT "widget_settings_app_a_p_i_domains_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."widget_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "widget_settings_rels" ADD CONSTRAINT "widget_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."widget_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "widget_settings_rels" ADD CONSTRAINT "widget_settings_rels_branches_fk" FOREIGN KEY ("branches_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "widget_settings_rels" ADD CONSTRAINT "widget_settings_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "widget_settings_rels" ADD CONSTRAINT "widget_settings_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "p2p_usage" ADD CONSTRAINT "p2p_usage_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "p2p_usage" ADD CONSTRAINT "p2p_usage_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."p2p_offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "p2p_offers" ADD CONSTRAINT "p2p_offers_buy_product_id_products_id_fk" FOREIGN KEY ("buy_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "p2p_offers" ADD CONSTRAINT "p2p_offers_free_product_id_products_id_fk" FOREIGN KEY ("free_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "p2p_offers" ADD CONSTRAINT "p2p_offers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customer_offer_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "price_usage" ADD CONSTRAINT "price_usage_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "price_usage" ADD CONSTRAINT "price_usage_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."price_offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "price_offers" ADD CONSTRAINT "price_offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "price_offers" ADD CONSTRAINT "price_offers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customer_offer_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "random_usage" ADD CONSTRAINT "random_usage_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "random_usage" ADD CONSTRAINT "random_usage_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."random_offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "random_offers" ADD CONSTRAINT "random_offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "random_offers" ADD CONSTRAINT "random_offers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customer_offer_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tp_usage" ADD CONSTRAINT "tp_usage_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tp_usage" ADD CONSTRAINT "tp_usage_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customer_offer_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cep_usage" ADD CONSTRAINT "cep_usage_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cep_usage" ADD CONSTRAINT "cep_usage_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customer_offer_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "amount_usage" ADD CONSTRAINT "amount_usage_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "amount_usage" ADD CONSTRAINT "amount_usage_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."amount_offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "amount_offers" ADD CONSTRAINT "amount_offers_free_product_id_products_id_fk" FOREIGN KEY ("free_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "amount_offers" ADD CONSTRAINT "amount_offers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customer_offer_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customer_offer_settings_rels" ADD CONSTRAINT "customer_offer_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."customer_offer_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customer_offer_settings_rels" ADD CONSTRAINT "customer_offer_settings_rels_branches_fk" FOREIGN KEY ("branches_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customer_offer_settings_rels" ADD CONSTRAINT "customer_offer_settings_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "app_download_settings_apps" ADD CONSTRAINT "app_download_settings_apps_apk_file_id_apk_files_id_fk" FOREIGN KEY ("apk_file_id") REFERENCES "public"."apk_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "app_download_settings_apps" ADD CONSTRAINT "app_download_settings_apps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."app_download_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_branch_idx" ON "users" USING btree ("branch_id");
  CREATE INDEX "users_last_login_branch_idx" ON "users" USING btree ("last_login_branch_id");
  CREATE INDEX "users_company_idx" ON "users" USING btree ("company_id");
  CREATE INDEX "users_employee_idx" ON "users" USING btree ("employee_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_branches_id_idx" ON "users_rels" USING btree ("branches_id");
  CREATE INDEX "users_rels_kitchens_id_idx" ON "users_rels" USING btree ("kitchens_id");
  CREATE INDEX "users_rels_categories_id_idx" ON "users_rels" USING btree ("categories_id");
  CREATE INDEX "users_rels_companies_id_idx" ON "users_rels" USING btree ("companies_id");
  CREATE INDEX "companies_updated_at_idx" ON "companies" USING btree ("updated_at");
  CREATE INDEX "companies_created_at_idx" ON "companies" USING btree ("created_at");
  CREATE INDEX "branches_product_resets_order_idx" ON "branches_product_resets" USING btree ("_order");
  CREATE INDEX "branches_product_resets_parent_id_idx" ON "branches_product_resets" USING btree ("_parent_id");
  CREATE INDEX "branches_product_resets_product_idx" ON "branches_product_resets" USING btree ("product_id");
  CREATE INDEX "branches_company_idx" ON "branches" USING btree ("company_id");
  CREATE INDEX "branches_updated_at_idx" ON "branches" USING btree ("updated_at");
  CREATE INDEX "branches_created_at_idx" ON "branches" USING btree ("created_at");
  CREATE INDEX "company_idx" ON "branches" USING btree ("company_id");
  CREATE INDEX "departments_updated_at_idx" ON "departments" USING btree ("updated_at");
  CREATE INDEX "departments_created_at_idx" ON "departments" USING btree ("created_at");
  CREATE INDEX "departments_rels_order_idx" ON "departments_rels" USING btree ("order");
  CREATE INDEX "departments_rels_parent_idx" ON "departments_rels" USING btree ("parent_id");
  CREATE INDEX "departments_rels_path_idx" ON "departments_rels" USING btree ("path");
  CREATE INDEX "departments_rels_companies_id_idx" ON "departments_rels" USING btree ("companies_id");
  CREATE INDEX "categories_image_idx" ON "categories" USING btree ("image_id");
  CREATE INDEX "categories_department_idx" ON "categories" USING btree ("department_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "categories_rels_order_idx" ON "categories_rels" USING btree ("order");
  CREATE INDEX "categories_rels_parent_idx" ON "categories_rels" USING btree ("parent_id");
  CREATE INDEX "categories_rels_path_idx" ON "categories_rels" USING btree ("path");
  CREATE INDEX "categories_rels_companies_id_idx" ON "categories_rels" USING btree ("companies_id");
  CREATE INDEX "products_images_order_idx" ON "products_images" USING btree ("_order");
  CREATE INDEX "products_images_parent_id_idx" ON "products_images" USING btree ("_parent_id");
  CREATE INDEX "products_images_image_idx" ON "products_images" USING btree ("image_id");
  CREATE INDEX "products_branch_overrides_order_idx" ON "products_branch_overrides" USING btree ("_order");
  CREATE INDEX "products_branch_overrides_parent_id_idx" ON "products_branch_overrides" USING btree ("_parent_id");
  CREATE INDEX "products_branch_overrides_branch_idx" ON "products_branch_overrides" USING btree ("branch_id");
  CREATE UNIQUE INDEX "products_name_idx" ON "products" USING btree ("name");
  CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");
  CREATE INDEX "products_dealer_idx" ON "products" USING btree ("dealer_id");
  CREATE UNIQUE INDEX "products_product_id_idx" ON "products" USING btree ("product_id");
  CREATE UNIQUE INDEX "products_upc_idx" ON "products" USING btree ("upc");
  CREATE INDEX "products_is_stock_idx" ON "products" USING btree ("is_stock");
  CREATE INDEX "products_is_out_of_stock_idx" ON "products" USING btree ("is_out_of_stock");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "category_idx" ON "products" USING btree ("category_id");
  CREATE INDEX "category_name_idx" ON "products" USING btree ("category_id","name");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_branches_id_idx" ON "products_rels" USING btree ("branches_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "dealers_updated_at_idx" ON "dealers" USING btree ("updated_at");
  CREATE INDEX "dealers_created_at_idx" ON "dealers" USING btree ("created_at");
  CREATE INDEX "dealers_rels_order_idx" ON "dealers_rels" USING btree ("order");
  CREATE INDEX "dealers_rels_parent_idx" ON "dealers_rels" USING btree ("parent_id");
  CREATE INDEX "dealers_rels_path_idx" ON "dealers_rels" USING btree ("path");
  CREATE INDEX "dealers_rels_companies_id_idx" ON "dealers_rels" USING btree ("companies_id");
  CREATE INDEX "dealers_rels_branches_id_idx" ON "dealers_rels" USING btree ("branches_id");
  CREATE UNIQUE INDEX "employees_employee_id_idx" ON "employees" USING btree ("employee_id");
  CREATE INDEX "employees_aadhaar_photo_idx" ON "employees" USING btree ("aadhaar_photo_id");
  CREATE INDEX "employees_photo_idx" ON "employees" USING btree ("photo_id");
  CREATE INDEX "employees_updated_at_idx" ON "employees" USING btree ("updated_at");
  CREATE INDEX "employees_created_at_idx" ON "employees" USING btree ("created_at");
  CREATE UNIQUE INDEX "message_threads_staff_user_idx" ON "message_threads" USING btree ("staff_user_id");
  CREATE INDEX "message_threads_employee_idx" ON "message_threads" USING btree ("employee_id");
  CREATE INDEX "message_threads_last_message_at_idx" ON "message_threads" USING btree ("last_message_at");
  CREATE INDEX "message_threads_last_message_by_user_idx" ON "message_threads" USING btree ("last_message_by_user_id");
  CREATE INDEX "message_threads_updated_at_idx" ON "message_threads" USING btree ("updated_at");
  CREATE INDEX "message_threads_created_at_idx" ON "message_threads" USING btree ("created_at");
  CREATE INDEX "message_attachments_thread_idx" ON "message_attachments" USING btree ("thread_id");
  CREATE INDEX "message_attachments_staff_user_idx" ON "message_attachments" USING btree ("staff_user_id");
  CREATE INDEX "message_attachments_employee_idx" ON "message_attachments" USING btree ("employee_id");
  CREATE INDEX "message_attachments_uploaded_by_idx" ON "message_attachments" USING btree ("uploaded_by_id");
  CREATE INDEX "message_attachments_attachment_type_idx" ON "message_attachments" USING btree ("attachment_type");
  CREATE INDEX "message_attachments_updated_at_idx" ON "message_attachments" USING btree ("updated_at");
  CREATE INDEX "message_attachments_created_at_idx" ON "message_attachments" USING btree ("created_at");
  CREATE UNIQUE INDEX "message_attachments_filename_idx" ON "message_attachments" USING btree ("filename");
  CREATE INDEX "messages_thread_idx" ON "messages" USING btree ("thread_id");
  CREATE INDEX "messages_staff_user_idx" ON "messages" USING btree ("staff_user_id");
  CREATE INDEX "messages_employee_idx" ON "messages" USING btree ("employee_id");
  CREATE INDEX "messages_seq_idx" ON "messages" USING btree ("seq");
  CREATE INDEX "messages_sender_user_idx" ON "messages" USING btree ("sender_user_id");
  CREATE INDEX "messages_sender_role_idx" ON "messages" USING btree ("sender_role");
  CREATE INDEX "messages_recipient_audience_idx" ON "messages" USING btree ("recipient_audience");
  CREATE INDEX "messages_message_type_idx" ON "messages" USING btree ("message_type");
  CREATE INDEX "messages_attachment_idx" ON "messages" USING btree ("attachment_id");
  CREATE INDEX "messages_updated_at_idx" ON "messages" USING btree ("updated_at");
  CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");
  CREATE INDEX "message_receipts_message_idx" ON "message_receipts" USING btree ("message_id");
  CREATE INDEX "message_receipts_thread_idx" ON "message_receipts" USING btree ("thread_id");
  CREATE INDEX "message_receipts_staff_user_idx" ON "message_receipts" USING btree ("staff_user_id");
  CREATE INDEX "message_receipts_employee_idx" ON "message_receipts" USING btree ("employee_id");
  CREATE INDEX "message_receipts_recipient_audience_idx" ON "message_receipts" USING btree ("recipient_audience");
  CREATE INDEX "message_receipts_recipient_user_idx" ON "message_receipts" USING btree ("recipient_user_id");
  CREATE INDEX "message_receipts_status_idx" ON "message_receipts" USING btree ("status");
  CREATE INDEX "message_receipts_delivered_by_user_idx" ON "message_receipts" USING btree ("delivered_by_user_id");
  CREATE INDEX "message_receipts_read_by_user_idx" ON "message_receipts" USING btree ("read_by_user_id");
  CREATE INDEX "message_receipts_updated_at_idx" ON "message_receipts" USING btree ("updated_at");
  CREATE INDEX "message_receipts_created_at_idx" ON "message_receipts" USING btree ("created_at");
  CREATE INDEX "billings_items_order_idx" ON "billings_items" USING btree ("_order");
  CREATE INDEX "billings_items_parent_id_idx" ON "billings_items" USING btree ("_parent_id");
  CREATE INDEX "billings_items_product_idx" ON "billings_items" USING btree ("product_id");
  CREATE INDEX "billings_items_status_idx" ON "billings_items" USING btree ("status");
  CREATE INDEX "billings_items_offer_trigger_product_idx" ON "billings_items" USING btree ("offer_trigger_product_id");
  CREATE INDEX "billings_items_prepared_by_idx" ON "billings_items" USING btree ("prepared_by_id");
  CREATE INDEX "billings_items_confirmed_by_idx" ON "billings_items" USING btree ("confirmed_by_id");
  CREATE INDEX "billings_items_delivered_by_idx" ON "billings_items" USING btree ("delivered_by_id");
  CREATE UNIQUE INDEX "billings_invoice_number_idx" ON "billings" USING btree ("invoice_number");
  CREATE INDEX "billings_kot_number_idx" ON "billings" USING btree ("kot_number");
  CREATE INDEX "billings_branch_idx" ON "billings" USING btree ("branch_id");
  CREATE INDEX "billings_created_by_idx" ON "billings" USING btree ("created_by_id");
  CREATE INDEX "billings_company_idx" ON "billings" USING btree ("company_id");
  CREATE INDEX "billings_status_idx" ON "billings" USING btree ("status");
  CREATE INDEX "billings_table_details_table_details_table_number_idx" ON "billings" USING btree ("table_details_table_number");
  CREATE INDEX "billings_updated_at_idx" ON "billings" USING btree ("updated_at");
  CREATE INDEX "billings_created_at_idx" ON "billings" USING btree ("created_at");
  CREATE INDEX "customerDetails_phoneNumber_createdAt_idx" ON "billings" USING btree ("customer_details_phone_number","created_at");
  CREATE INDEX "branch_createdAt_idx" ON "billings" USING btree ("branch_id","created_at");
  CREATE INDEX "return_orders_items_order_idx" ON "return_orders_items" USING btree ("_order");
  CREATE INDEX "return_orders_items_parent_id_idx" ON "return_orders_items" USING btree ("_parent_id");
  CREATE INDEX "return_orders_items_product_idx" ON "return_orders_items" USING btree ("product_id");
  CREATE INDEX "return_orders_items_proof_photo_idx" ON "return_orders_items" USING btree ("proof_photo_id");
  CREATE UNIQUE INDEX "return_orders_return_number_idx" ON "return_orders" USING btree ("return_number");
  CREATE INDEX "return_orders_branch_idx" ON "return_orders" USING btree ("branch_id");
  CREATE INDEX "return_orders_created_by_idx" ON "return_orders" USING btree ("created_by_id");
  CREATE INDEX "return_orders_company_idx" ON "return_orders" USING btree ("company_id");
  CREATE INDEX "return_orders_updated_at_idx" ON "return_orders" USING btree ("updated_at");
  CREATE INDEX "return_orders_created_at_idx" ON "return_orders" USING btree ("created_at");
  CREATE UNIQUE INDEX "closing_entries_closing_number_idx" ON "closing_entries" USING btree ("closing_number");
  CREATE INDEX "closing_entries_branch_idx" ON "closing_entries" USING btree ("branch_id");
  CREATE INDEX "closing_entries_updated_at_idx" ON "closing_entries" USING btree ("updated_at");
  CREATE INDEX "closing_entries_created_at_idx" ON "closing_entries" USING btree ("created_at");
  CREATE INDEX "expenses_details_order_idx" ON "expenses_details" USING btree ("_order");
  CREATE INDEX "expenses_details_parent_id_idx" ON "expenses_details" USING btree ("_parent_id");
  CREATE INDEX "expenses_details_image_idx" ON "expenses_details" USING btree ("image_id");
  CREATE UNIQUE INDEX "expenses_invoice_number_idx" ON "expenses" USING btree ("invoice_number");
  CREATE INDEX "expenses_branch_idx" ON "expenses" USING btree ("branch_id");
  CREATE INDEX "expenses_updated_at_idx" ON "expenses" USING btree ("updated_at");
  CREATE INDEX "expenses_created_at_idx" ON "expenses" USING btree ("created_at");
  CREATE INDEX "stock_orders_items_order_idx" ON "stock_orders_items" USING btree ("_order");
  CREATE INDEX "stock_orders_items_parent_id_idx" ON "stock_orders_items" USING btree ("_parent_id");
  CREATE INDEX "stock_orders_items_product_idx" ON "stock_orders_items" USING btree ("product_id");
  CREATE INDEX "stock_orders_items_sending_updated_by_idx" ON "stock_orders_items" USING btree ("sending_updated_by_id");
  CREATE INDEX "stock_orders_items_confirmed_updated_by_idx" ON "stock_orders_items" USING btree ("confirmed_updated_by_id");
  CREATE INDEX "stock_orders_items_picked_updated_by_idx" ON "stock_orders_items" USING btree ("picked_updated_by_id");
  CREATE UNIQUE INDEX "stock_orders_invoice_number_idx" ON "stock_orders" USING btree ("invoice_number");
  CREATE INDEX "stock_orders_branch_idx" ON "stock_orders" USING btree ("branch_id");
  CREATE INDEX "stock_orders_created_by_idx" ON "stock_orders" USING btree ("created_by_id");
  CREATE INDEX "stock_orders_company_idx" ON "stock_orders" USING btree ("company_id");
  CREATE INDEX "stock_orders_updated_at_idx" ON "stock_orders" USING btree ("updated_at");
  CREATE INDEX "stock_orders_created_at_idx" ON "stock_orders" USING btree ("created_at");
  CREATE INDEX "reviews_items_order_idx" ON "reviews_items" USING btree ("_order");
  CREATE INDEX "reviews_items_parent_id_idx" ON "reviews_items" USING btree ("_parent_id");
  CREATE INDEX "reviews_items_product_idx" ON "reviews_items" USING btree ("product_id");
  CREATE INDEX "reviews_bill_idx" ON "reviews" USING btree ("bill_id");
  CREATE INDEX "reviews_branch_idx" ON "reviews" USING btree ("branch_id");
  CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
  CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
  CREATE UNIQUE INDEX "customers_phone_number_idx" ON "customers" USING btree ("phone_number");
  CREATE INDEX "customers_random_customer_offer_product_idx" ON "customers" USING btree ("random_customer_offer_product_id");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE INDEX "customers_rels_order_idx" ON "customers_rels" USING btree ("order");
  CREATE INDEX "customers_rels_parent_idx" ON "customers_rels" USING btree ("parent_id");
  CREATE INDEX "customers_rels_path_idx" ON "customers_rels" USING btree ("path");
  CREATE INDEX "customers_rels_billings_id_idx" ON "customers_rels" USING btree ("billings_id");
  CREATE UNIQUE INDEX "billing_customers_phone_number_idx" ON "billing_customers" USING btree ("phone_number");
  CREATE INDEX "billing_customers_last_bill_idx" ON "billing_customers" USING btree ("last_bill_id");
  CREATE INDEX "billing_customers_updated_at_idx" ON "billing_customers" USING btree ("updated_at");
  CREATE INDEX "billing_customers_created_at_idx" ON "billing_customers" USING btree ("created_at");
  CREATE INDEX "instock_entries_items_order_idx" ON "instock_entries_items" USING btree ("_order");
  CREATE INDEX "instock_entries_items_parent_id_idx" ON "instock_entries_items" USING btree ("_parent_id");
  CREATE INDEX "instock_entries_items_product_idx" ON "instock_entries_items" USING btree ("product_id");
  CREATE INDEX "instock_entries_items_dealer_idx" ON "instock_entries_items" USING btree ("dealer_id");
  CREATE UNIQUE INDEX "instock_entries_invoice_number_idx" ON "instock_entries" USING btree ("invoice_number");
  CREATE INDEX "instock_entries_branch_idx" ON "instock_entries" USING btree ("branch_id");
  CREATE INDEX "instock_entries_created_by_idx" ON "instock_entries" USING btree ("created_by_id");
  CREATE INDEX "instock_entries_company_idx" ON "instock_entries" USING btree ("company_id");
  CREATE INDEX "instock_entries_updated_at_idx" ON "instock_entries" USING btree ("updated_at");
  CREATE INDEX "instock_entries_created_at_idx" ON "instock_entries" USING btree ("created_at");
  CREATE INDEX "tables_sections_range_rows_order_idx" ON "tables_sections_range_rows" USING btree ("_order");
  CREATE INDEX "tables_sections_range_rows_parent_id_idx" ON "tables_sections_range_rows" USING btree ("_parent_id");
  CREATE INDEX "tables_sections_order_idx" ON "tables_sections" USING btree ("_order");
  CREATE INDEX "tables_sections_parent_id_idx" ON "tables_sections" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "tables_branch_idx" ON "tables" USING btree ("branch_id");
  CREATE INDEX "tables_updated_at_idx" ON "tables" USING btree ("updated_at");
  CREATE INDEX "tables_created_at_idx" ON "tables" USING btree ("created_at");
  CREATE INDEX "kitchens_updated_at_idx" ON "kitchens" USING btree ("updated_at");
  CREATE INDEX "kitchens_created_at_idx" ON "kitchens" USING btree ("created_at");
  CREATE INDEX "kitchens_rels_order_idx" ON "kitchens_rels" USING btree ("order");
  CREATE INDEX "kitchens_rels_parent_idx" ON "kitchens_rels" USING btree ("parent_id");
  CREATE INDEX "kitchens_rels_path_idx" ON "kitchens_rels" USING btree ("path");
  CREATE INDEX "kitchens_rels_departments_id_idx" ON "kitchens_rels" USING btree ("departments_id");
  CREATE INDEX "kitchens_rels_branches_id_idx" ON "kitchens_rels" USING btree ("branches_id");
  CREATE INDEX "kitchens_rels_categories_id_idx" ON "kitchens_rels" USING btree ("categories_id");
  CREATE INDEX "attendance_activities_order_idx" ON "attendance_activities" USING btree ("_order");
  CREATE INDEX "attendance_activities_parent_id_idx" ON "attendance_activities" USING btree ("_parent_id");
  CREATE INDEX "attendance_user_idx" ON "attendance" USING btree ("user_id");
  CREATE INDEX "attendance_date_idx" ON "attendance" USING btree ("date");
  CREATE INDEX "attendance_date_string_idx" ON "attendance" USING btree ("date_string");
  CREATE INDEX "attendance_updated_at_idx" ON "attendance" USING btree ("updated_at");
  CREATE INDEX "attendance_created_at_idx" ON "attendance" USING btree ("created_at");
  CREATE INDEX "apk_files_updated_at_idx" ON "apk_files" USING btree ("updated_at");
  CREATE INDEX "apk_files_created_at_idx" ON "apk_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "apk_files_filename_idx" ON "apk_files" USING btree ("filename");
  CREATE INDEX "stock_alerts_branch_idx" ON "stock_alerts" USING btree ("branch_id");
  CREATE INDEX "stock_alerts_product_idx" ON "stock_alerts" USING btree ("product_id");
  CREATE INDEX "stock_alerts_requested_by_idx" ON "stock_alerts" USING btree ("requested_by_id");
  CREATE INDEX "stock_alerts_status_idx" ON "stock_alerts" USING btree ("status");
  CREATE INDEX "stock_alerts_acknowledged_by_idx" ON "stock_alerts" USING btree ("acknowledged_by_id");
  CREATE INDEX "stock_alerts_updated_at_idx" ON "stock_alerts" USING btree ("updated_at");
  CREATE INDEX "stock_alerts_created_at_idx" ON "stock_alerts" USING btree ("created_at");
  CREATE INDEX "idempotency_keys_key_idx" ON "idempotency_keys" USING btree ("key");
  CREATE INDEX "idempotency_keys_scope_idx" ON "idempotency_keys" USING btree ("scope");
  CREATE INDEX "idempotency_keys_request_hash_idx" ON "idempotency_keys" USING btree ("request_hash");
  CREATE INDEX "idempotency_keys_status_idx" ON "idempotency_keys" USING btree ("status");
  CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");
  CREATE INDEX "idempotency_keys_updated_at_idx" ON "idempotency_keys" USING btree ("updated_at");
  CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys" USING btree ("created_at");
  CREATE UNIQUE INDEX "key_scope_idx" ON "idempotency_keys" USING btree ("key","scope");
  CREATE INDEX "status_updatedAt_idx" ON "idempotency_keys" USING btree ("status","updated_at");
  CREATE INDEX "expiresAt_idx" ON "idempotency_keys" USING btree ("expires_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_companies_id_idx" ON "payload_locked_documents_rels" USING btree ("companies_id");
  CREATE INDEX "payload_locked_documents_rels_branches_id_idx" ON "payload_locked_documents_rels" USING btree ("branches_id");
  CREATE INDEX "payload_locked_documents_rels_departments_id_idx" ON "payload_locked_documents_rels" USING btree ("departments_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_dealers_id_idx" ON "payload_locked_documents_rels" USING btree ("dealers_id");
  CREATE INDEX "payload_locked_documents_rels_employees_id_idx" ON "payload_locked_documents_rels" USING btree ("employees_id");
  CREATE INDEX "payload_locked_documents_rels_message_threads_id_idx" ON "payload_locked_documents_rels" USING btree ("message_threads_id");
  CREATE INDEX "payload_locked_documents_rels_message_attachments_id_idx" ON "payload_locked_documents_rels" USING btree ("message_attachments_id");
  CREATE INDEX "payload_locked_documents_rels_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("messages_id");
  CREATE INDEX "payload_locked_documents_rels_message_receipts_id_idx" ON "payload_locked_documents_rels" USING btree ("message_receipts_id");
  CREATE INDEX "payload_locked_documents_rels_billings_id_idx" ON "payload_locked_documents_rels" USING btree ("billings_id");
  CREATE INDEX "payload_locked_documents_rels_return_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("return_orders_id");
  CREATE INDEX "payload_locked_documents_rels_closing_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("closing_entries_id");
  CREATE INDEX "payload_locked_documents_rels_expenses_id_idx" ON "payload_locked_documents_rels" USING btree ("expenses_id");
  CREATE INDEX "payload_locked_documents_rels_stock_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("stock_orders_id");
  CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_billing_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("billing_customers_id");
  CREATE INDEX "payload_locked_documents_rels_instock_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("instock_entries_id");
  CREATE INDEX "payload_locked_documents_rels_tables_id_idx" ON "payload_locked_documents_rels" USING btree ("tables_id");
  CREATE INDEX "payload_locked_documents_rels_kitchens_id_idx" ON "payload_locked_documents_rels" USING btree ("kitchens_id");
  CREATE INDEX "payload_locked_documents_rels_attendance_id_idx" ON "payload_locked_documents_rels" USING btree ("attendance_id");
  CREATE INDEX "payload_locked_documents_rels_apk_files_id_idx" ON "payload_locked_documents_rels" USING btree ("apk_files_id");
  CREATE INDEX "payload_locked_documents_rels_stock_alerts_id_idx" ON "payload_locked_documents_rels" USING btree ("stock_alerts_id");
  CREATE INDEX "payload_locked_documents_rels_idempotency_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("idempotency_keys_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "ip_settings_role_restrictions_ip_ranges_order_idx" ON "ip_settings_role_restrictions_ip_ranges" USING btree ("_order");
  CREATE INDEX "ip_settings_role_restrictions_ip_ranges_parent_id_idx" ON "ip_settings_role_restrictions_ip_ranges" USING btree ("_parent_id");
  CREATE INDEX "ip_settings_role_restrictions_order_idx" ON "ip_settings_role_restrictions" USING btree ("_order");
  CREATE INDEX "ip_settings_role_restrictions_parent_id_idx" ON "ip_settings_role_restrictions" USING btree ("_parent_id");
  CREATE INDEX "branch_geo_settings_locations_kot_printers_order_idx" ON "branch_geo_settings_locations_kot_printers" USING btree ("_order");
  CREATE INDEX "branch_geo_settings_locations_kot_printers_parent_id_idx" ON "branch_geo_settings_locations_kot_printers" USING btree ("_parent_id");
  CREATE INDEX "branch_geo_settings_locations_order_idx" ON "branch_geo_settings_locations" USING btree ("_order");
  CREATE INDEX "branch_geo_settings_locations_parent_id_idx" ON "branch_geo_settings_locations" USING btree ("_parent_id");
  CREATE INDEX "branch_geo_settings_locations_branch_idx" ON "branch_geo_settings_locations" USING btree ("branch_id");
  CREATE INDEX "branch_geo_settings_rels_order_idx" ON "branch_geo_settings_rels" USING btree ("order");
  CREATE INDEX "branch_geo_settings_rels_parent_idx" ON "branch_geo_settings_rels" USING btree ("parent_id");
  CREATE INDEX "branch_geo_settings_rels_path_idx" ON "branch_geo_settings_rels" USING btree ("path");
  CREATE INDEX "branch_geo_settings_rels_kitchens_id_idx" ON "branch_geo_settings_rels" USING btree ("kitchens_id");
  CREATE INDEX "widget_settings_table_order_customer_details_by_branch_order_idx" ON "widget_settings_table_order_customer_details_by_branch" USING btree ("_order");
  CREATE INDEX "widget_settings_table_order_customer_details_by_branch_parent_id_idx" ON "widget_settings_table_order_customer_details_by_branch" USING btree ("_parent_id");
  CREATE INDEX "widget_settings_table_order_customer_details_by_branch_b_idx" ON "widget_settings_table_order_customer_details_by_branch" USING btree ("branch_id");
  CREATE INDEX "widget_settings_billing_order_customer_details_by_branch_order_idx" ON "widget_settings_billing_order_customer_details_by_branch" USING btree ("_order");
  CREATE INDEX "widget_settings_billing_order_customer_details_by_branch_parent_id_idx" ON "widget_settings_billing_order_customer_details_by_branch" USING btree ("_parent_id");
  CREATE INDEX "widget_settings_billing_order_customer_details_by_branch_idx" ON "widget_settings_billing_order_customer_details_by_branch" USING btree ("branch_id");
  CREATE INDEX "widget_settings_favorite_products_by_branch_rules_order_idx" ON "widget_settings_favorite_products_by_branch_rules" USING btree ("_order");
  CREATE INDEX "widget_settings_favorite_products_by_branch_rules_parent_id_idx" ON "widget_settings_favorite_products_by_branch_rules" USING btree ("_parent_id");
  CREATE INDEX "widget_settings_favorite_categories_by_branch_rules_order_idx" ON "widget_settings_favorite_categories_by_branch_rules" USING btree ("_order");
  CREATE INDEX "widget_settings_favorite_categories_by_branch_rules_parent_id_idx" ON "widget_settings_favorite_categories_by_branch_rules" USING btree ("_parent_id");
  CREATE INDEX "widget_settings_table_q_r_domains_order_idx" ON "widget_settings_table_q_r_domains" USING btree ("_order");
  CREATE INDEX "widget_settings_table_q_r_domains_parent_id_idx" ON "widget_settings_table_q_r_domains" USING btree ("_parent_id");
  CREATE INDEX "widget_settings_app_a_p_i_domains_domains_order_idx" ON "widget_settings_app_a_p_i_domains_domains" USING btree ("_order");
  CREATE INDEX "widget_settings_app_a_p_i_domains_domains_parent_id_idx" ON "widget_settings_app_a_p_i_domains_domains" USING btree ("_parent_id");
  CREATE INDEX "widget_settings_app_a_p_i_domains_order_idx" ON "widget_settings_app_a_p_i_domains" USING btree ("_order");
  CREATE INDEX "widget_settings_app_a_p_i_domains_parent_id_idx" ON "widget_settings_app_a_p_i_domains" USING btree ("_parent_id");
  CREATE INDEX "widget_settings_rels_order_idx" ON "widget_settings_rels" USING btree ("order");
  CREATE INDEX "widget_settings_rels_parent_idx" ON "widget_settings_rels" USING btree ("parent_id");
  CREATE INDEX "widget_settings_rels_path_idx" ON "widget_settings_rels" USING btree ("path");
  CREATE INDEX "widget_settings_rels_branches_id_idx" ON "widget_settings_rels" USING btree ("branches_id");
  CREATE INDEX "widget_settings_rels_categories_id_idx" ON "widget_settings_rels" USING btree ("categories_id");
  CREATE INDEX "widget_settings_rels_products_id_idx" ON "widget_settings_rels" USING btree ("products_id");
  CREATE INDEX "p2p_usage_order_idx" ON "p2p_usage" USING btree ("_order");
  CREATE INDEX "p2p_usage_parent_id_idx" ON "p2p_usage" USING btree ("_parent_id");
  CREATE INDEX "p2p_usage_customer_idx" ON "p2p_usage" USING btree ("customer_id");
  CREATE INDEX "p2p_offers_order_idx" ON "p2p_offers" USING btree ("_order");
  CREATE INDEX "p2p_offers_parent_id_idx" ON "p2p_offers" USING btree ("_parent_id");
  CREATE INDEX "p2p_offers_buy_product_idx" ON "p2p_offers" USING btree ("buy_product_id");
  CREATE INDEX "p2p_offers_free_product_idx" ON "p2p_offers" USING btree ("free_product_id");
  CREATE INDEX "price_usage_order_idx" ON "price_usage" USING btree ("_order");
  CREATE INDEX "price_usage_parent_id_idx" ON "price_usage" USING btree ("_parent_id");
  CREATE INDEX "price_usage_customer_idx" ON "price_usage" USING btree ("customer_id");
  CREATE INDEX "price_offers_order_idx" ON "price_offers" USING btree ("_order");
  CREATE INDEX "price_offers_parent_id_idx" ON "price_offers" USING btree ("_parent_id");
  CREATE INDEX "price_offers_product_idx" ON "price_offers" USING btree ("product_id");
  CREATE INDEX "random_usage_order_idx" ON "random_usage" USING btree ("_order");
  CREATE INDEX "random_usage_parent_id_idx" ON "random_usage" USING btree ("_parent_id");
  CREATE INDEX "random_usage_customer_idx" ON "random_usage" USING btree ("customer_id");
  CREATE INDEX "random_offers_order_idx" ON "random_offers" USING btree ("_order");
  CREATE INDEX "random_offers_parent_id_idx" ON "random_offers" USING btree ("_parent_id");
  CREATE INDEX "random_offers_product_idx" ON "random_offers" USING btree ("product_id");
  CREATE INDEX "tp_usage_order_idx" ON "tp_usage" USING btree ("_order");
  CREATE INDEX "tp_usage_parent_id_idx" ON "tp_usage" USING btree ("_parent_id");
  CREATE INDEX "tp_usage_customer_idx" ON "tp_usage" USING btree ("customer_id");
  CREATE INDEX "cep_usage_order_idx" ON "cep_usage" USING btree ("_order");
  CREATE INDEX "cep_usage_parent_id_idx" ON "cep_usage" USING btree ("_parent_id");
  CREATE INDEX "cep_usage_customer_idx" ON "cep_usage" USING btree ("customer_id");
  CREATE INDEX "amount_usage_order_idx" ON "amount_usage" USING btree ("_order");
  CREATE INDEX "amount_usage_parent_id_idx" ON "amount_usage" USING btree ("_parent_id");
  CREATE INDEX "amount_usage_customer_idx" ON "amount_usage" USING btree ("customer_id");
  CREATE INDEX "amount_offers_order_idx" ON "amount_offers" USING btree ("_order");
  CREATE INDEX "amount_offers_parent_id_idx" ON "amount_offers" USING btree ("_parent_id");
  CREATE INDEX "amount_offers_free_product_idx" ON "amount_offers" USING btree ("free_product_id");
  CREATE INDEX "customer_offer_settings_rels_order_idx" ON "customer_offer_settings_rels" USING btree ("order");
  CREATE INDEX "customer_offer_settings_rels_parent_idx" ON "customer_offer_settings_rels" USING btree ("parent_id");
  CREATE INDEX "customer_offer_settings_rels_path_idx" ON "customer_offer_settings_rels" USING btree ("path");
  CREATE INDEX "customer_offer_settings_rels_branches_id_idx" ON "customer_offer_settings_rels" USING btree ("branches_id");
  CREATE INDEX "customer_offer_settings_rels_customers_id_idx" ON "customer_offer_settings_rels" USING btree ("customers_id");
  CREATE INDEX "app_download_settings_apps_order_idx" ON "app_download_settings_apps" USING btree ("_order");
  CREATE INDEX "app_download_settings_apps_parent_id_idx" ON "app_download_settings_apps" USING btree ("_parent_id");
  CREATE INDEX "app_download_settings_apps_apk_file_idx" ON "app_download_settings_apps" USING btree ("apk_file_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  DROP TABLE "companies" CASCADE;
  DROP TABLE "branches_product_resets" CASCADE;
  DROP TABLE "branches" CASCADE;
  DROP TABLE "departments" CASCADE;
  DROP TABLE "departments_rels" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "categories_rels" CASCADE;
  DROP TABLE "products_images" CASCADE;
  DROP TABLE "products_branch_overrides" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "dealers" CASCADE;
  DROP TABLE "dealers_rels" CASCADE;
  DROP TABLE "employees" CASCADE;
  DROP TABLE "message_threads" CASCADE;
  DROP TABLE "message_attachments" CASCADE;
  DROP TABLE "messages" CASCADE;
  DROP TABLE "message_receipts" CASCADE;
  DROP TABLE "billings_items" CASCADE;
  DROP TABLE "billings" CASCADE;
  DROP TABLE "return_orders_items" CASCADE;
  DROP TABLE "return_orders" CASCADE;
  DROP TABLE "closing_entries" CASCADE;
  DROP TABLE "expenses_details" CASCADE;
  DROP TABLE "expenses" CASCADE;
  DROP TABLE "stock_orders_items" CASCADE;
  DROP TABLE "stock_orders" CASCADE;
  DROP TABLE "reviews_items" CASCADE;
  DROP TABLE "reviews" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "customers_rels" CASCADE;
  DROP TABLE "billing_customers" CASCADE;
  DROP TABLE "instock_entries_items" CASCADE;
  DROP TABLE "instock_entries" CASCADE;
  DROP TABLE "tables_sections_range_rows" CASCADE;
  DROP TABLE "tables_sections" CASCADE;
  DROP TABLE "tables" CASCADE;
  DROP TABLE "kitchens" CASCADE;
  DROP TABLE "kitchens_rels" CASCADE;
  DROP TABLE "attendance_activities" CASCADE;
  DROP TABLE "attendance" CASCADE;
  DROP TABLE "apk_files" CASCADE;
  DROP TABLE "stock_alerts" CASCADE;
  DROP TABLE "idempotency_keys" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "ip_settings_role_restrictions_ip_ranges" CASCADE;
  DROP TABLE "ip_settings_role_restrictions" CASCADE;
  DROP TABLE "ip_settings" CASCADE;
  DROP TABLE "general_dashboard" CASCADE;
  DROP TABLE "branch_billing_report" CASCADE;
  DROP TABLE "category_wise_report" CASCADE;
  DROP TABLE "product_wise_report" CASCADE;
  DROP TABLE "product_time_report" CASCADE;
  DROP TABLE "chef_report" CASCADE;
  DROP TABLE "closing_entry_report" CASCADE;
  DROP TABLE "waiter_wise_billing_report" CASCADE;
  DROP TABLE "inventory_report" CASCADE;
  DROP TABLE "stock_order_report" CASCADE;
  DROP TABLE "afterstock_customer_report" CASCADE;
  DROP TABLE "review_report" CASCADE;
  DROP TABLE "instock_entry_report" CASCADE;
  DROP TABLE "expense_report" CASCADE;
  DROP TABLE "return_order_report" CASCADE;
  DROP TABLE "branch_geo_settings_locations_kot_printers" CASCADE;
  DROP TABLE "branch_geo_settings_locations" CASCADE;
  DROP TABLE "branch_geo_settings" CASCADE;
  DROP TABLE "branch_geo_settings_rels" CASCADE;
  DROP TABLE "network_status" CASCADE;
  DROP TABLE "widget_settings_table_order_customer_details_by_branch" CASCADE;
  DROP TABLE "widget_settings_billing_order_customer_details_by_branch" CASCADE;
  DROP TABLE "widget_settings_favorite_products_by_branch_rules" CASCADE;
  DROP TABLE "widget_settings_favorite_categories_by_branch_rules" CASCADE;
  DROP TABLE "widget_settings_table_q_r_domains" CASCADE;
  DROP TABLE "widget_settings_app_a_p_i_domains_domains" CASCADE;
  DROP TABLE "widget_settings_app_a_p_i_domains" CASCADE;
  DROP TABLE "widget_settings" CASCADE;
  DROP TABLE "widget_settings_rels" CASCADE;
  DROP TABLE "p2p_usage" CASCADE;
  DROP TABLE "p2p_offers" CASCADE;
  DROP TABLE "price_usage" CASCADE;
  DROP TABLE "price_offers" CASCADE;
  DROP TABLE "random_usage" CASCADE;
  DROP TABLE "random_offers" CASCADE;
  DROP TABLE "tp_usage" CASCADE;
  DROP TABLE "cep_usage" CASCADE;
  DROP TABLE "amount_usage" CASCADE;
  DROP TABLE "amount_offers" CASCADE;
  DROP TABLE "customer_offer_settings" CASCADE;
  DROP TABLE "customer_offer_settings_rels" CASCADE;
  DROP TABLE "app_download_settings_apps" CASCADE;
  DROP TABLE "app_download_settings" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_products_branch_overrides_unit";
  DROP TYPE "public"."enum_products_branch_overrides_gst";
  DROP TYPE "public"."enum_products_default_price_details_unit";
  DROP TYPE "public"."enum_products_default_price_details_gst";
  DROP TYPE "public"."enum_dealers_status";
  DROP TYPE "public"."enum_dealers_preferred_payment_method";
  DROP TYPE "public"."enum_employees_status";
  DROP TYPE "public"."enum_employees_team";
  DROP TYPE "public"."enum_message_threads_status";
  DROP TYPE "public"."enum_message_attachments_attachment_type";
  DROP TYPE "public"."enum_messages_recipient_audience";
  DROP TYPE "public"."enum_messages_message_type";
  DROP TYPE "public"."enum_message_receipts_recipient_audience";
  DROP TYPE "public"."enum_message_receipts_status";
  DROP TYPE "public"."enum_billings_items_status";
  DROP TYPE "public"."enum_billings_payment_method";
  DROP TYPE "public"."enum_billings_status";
  DROP TYPE "public"."enum_return_orders_status";
  DROP TYPE "public"."enum_expenses_details_source";
  DROP TYPE "public"."enum_stock_orders_items_status";
  DROP TYPE "public"."enum_stock_orders_status";
  DROP TYPE "public"."enum_reviews_items_status";
  DROP TYPE "public"."enum_instock_entries_items_status";
  DROP TYPE "public"."enum_instock_entries_status";
  DROP TYPE "public"."enum_attendance_activities_type";
  DROP TYPE "public"."enum_attendance_activities_status";
  DROP TYPE "public"."enum_attendance_status";
  DROP TYPE "public"."enum_attendance_type";
  DROP TYPE "public"."enum_stock_alerts_status";
  DROP TYPE "public"."enum_idempotency_keys_status";
  DROP TYPE "public"."enum_ip_settings_role_restrictions_ip_ranges_ip_type";
  DROP TYPE "public"."enum_ip_settings_role_restrictions_role";
  DROP TYPE "public"."enum_widget_settings_table_q_r_domains_type";
  DROP TYPE "public"."enum_widget_settings_app_a_p_i_domains_domains_type";
  DROP TYPE "public"."enum_widget_settings_app_a_p_i_domains_app_key";
  DROP TYPE "public"."enum_random_offers_daily_start_time";
  DROP TYPE "public"."enum_random_offers_daily_end_time";
  DROP TYPE "public"."tp_start";
  DROP TYPE "public"."tp_end";
  DROP TYPE "public"."cep_start";
  DROP TYPE "public"."cep_end";`)
}
