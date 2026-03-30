const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://byhnyrhltrqjzqhsajli.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5aG55cmhsdHJxanpxaHNhamxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDM2MjksImV4cCI6MjA4ODAxOTYyOX0.qex_-KP-vAF6TZ6e92xMuNdqm0SHfkoxGI3DVY5fUyI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createSuperadmin() {
  try {
    console.log('Creating superadmin user...');
    
    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'superadmin@platform.com',
      password: 'Super1234!',
      options: {
        emailRedirectTo: undefined
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError.message);
      return;
    }

    console.log('✅ Auth user created:', authData.user.email);
    console.log('Auth User ID:', authData.user.id);

    // Step 2: Create company_user record
    const { data: companyData, error: companyError } = await supabase
      .from('company_users')
      .insert({
        company_id: '00000000-0000-0000-0000-000000000000', // System company
        auth_user_id: authData.user.id,
        name: 'Platform Superadmin',
        email: 'superadmin@platform.com',
        status: 'active'
      })
      .select()
      .single();

    if (companyError) {
      console.error('Error creating company user:', companyError.message);
      return;
    }

    console.log('✅ Company user created:', companyData.email);
    console.log('Company User ID:', companyData.id);

    // Step 3: Get superadmin role ID
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Superadmin')
      .eq('company_id', '00000000-0000-0000-0000-000000000000')
      .single();

    if (roleError) {
      console.error('Error finding superadmin role:', roleError.message);
      return;
    }

    console.log('✅ Found superadmin role:', roleData.id);

    // Step 4: Assign role to user
    const { error: assignError } = await supabase
      .from('user_roles')
      .insert({
        user_id: companyData.id,
        role_id: roleData.id
      });

    if (assignError) {
      console.error('Error assigning role:', assignError.message);
      return;
    }

    console.log('🎉 Superadmin user created successfully!');
    console.log('📧 Email: superadmin@platform.com');
    console.log('🔑 Password: Super1234!');
    console.log('👤 Has Superadmin role with all permissions');

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

createSuperadmin();
