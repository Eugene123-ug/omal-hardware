import { Router } from 'express';
import { getDb } from '../../db/connection';
import { BadRequestError } from '../../common/errors';
import { authenticate, requireRole } from '../../middleware/auth';

export const settingsRouter = Router();

// GET /api/v1/settings/business
settingsRouter.get('/business', async (_req, res, next) => {
  try {
    const db = getDb();
    let settings = await db('business_settings').where('id', 1).first();

    if (!settings) {
      await db('business_settings').insert({
        id: 1,
        company_name: 'WONARK COMPANY LIMITED',
        address: 'Commercial Industrial Area, Greater Accra, Ghana',
        phone1: '+233 30 281 1200',
        phone2: '+233 24 455 6677',
        email: 'info@wonark.com',
        tin: 'C0001234567',
        website: 'www.wonark.com',
        currency: 'GHS',
        tax_rate: 0,
        default_low_stock_threshold: 10,
        receipt_footer: 'Thank you for your business!',
        terms_and_conditions: 'Goods sold in good condition are not returnable after 7 days.',
      }).onConflict('id').ignore();

      settings = await db('business_settings').where('id', 1).first();
    }

    res.json({
      success: true,
      data: {
        ...settings,
        tax_rate: Number(settings?.tax_rate || 0),
        default_low_stock_threshold: Number(settings?.default_low_stock_threshold || 10),
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/settings/business
settingsRouter.put('/business', authenticate, requireRole('owner', 'administrator'), async (req, res, next) => {
  try {
    const db = getDb();
    const {
      company_name,
      logo_url,
      address,
      phone1,
      phone2,
      email,
      tin,
      website,
      currency,
      tax_rate,
      default_low_stock_threshold,
      receipt_footer,
      terms_and_conditions,
    } = req.body;

    if (!company_name || !company_name.trim()) {
      throw new BadRequestError('Company name is required');
    }

    const payload: any = {
      company_name: company_name.trim(),
      address: address !== undefined ? address : 'Commercial Industrial Area, Greater Accra, Ghana',
      phone1: phone1 !== undefined ? phone1 : null,
      phone2: phone2 !== undefined ? phone2 : null,
      email: email !== undefined ? email : null,
      tin: tin !== undefined ? tin : null,
      website: website !== undefined ? website : null,
      currency: currency || 'GHS',
      tax_rate: tax_rate !== undefined ? Number(tax_rate) : 0,
      default_low_stock_threshold: default_low_stock_threshold !== undefined ? Number(default_low_stock_threshold) : 10,
      receipt_footer: receipt_footer !== undefined ? receipt_footer : 'Thank you for your business!',
      terms_and_conditions: terms_and_conditions !== undefined ? terms_and_conditions : '',
      updated_at: new Date(),
    };

    if (logo_url !== undefined) {
      payload.logo_url = logo_url;
    }

    await db('business_settings')
      .insert({ id: 1, ...payload })
      .onConflict('id')
      .merge();

    const updated = await db('business_settings').where('id', 1).first();

    // Log to audit trail
    try {
      await db('audit_logs').insert({
        actor_user_id: req.user?.id,
        actor_label: `${req.user?.fullName} (${req.user?.role})`,
        action: 'settings.business_update',
        entity_type: 'business_settings',
        entity_id: '1',
        after_data: JSON.stringify({ company_name: payload.company_name }),
        result: 'success',
      });
    } catch {
      // audit log shouldn't block response
    }

    res.json({
      success: true,
      data: {
        ...updated,
        tax_rate: Number(updated.tax_rate),
        default_low_stock_threshold: Number(updated.default_low_stock_threshold),
      },
      message: 'Business settings updated successfully',
    });
  } catch (err) {
    next(err);
  }
});
